/**
 * Remove indents
 */
export const xs = (
  strings: TemplateStringsArray,
  ...expressions: any[]
): string => {
  const indent: RegExp | null = !strings[0].startsWith('\n')
    ? null
    : new RegExp(`\n {${strings[0].match(/\n+( *)/)![1].length}}`, 'g');

  const replaceIndent = (str: string) =>
    indent ? str.replace(indent, '\n') : str;

  return expressions
    .reduce(
      (acc, expr, i) => `${acc}${expr}${replaceIndent(strings[i + 1])}`,
      replaceIndent(strings[0]),
    )
    .replace(/^\n|\n$/g, '');
};

// * HTML

// prettier-ignore
type TelegramHtmlTag =
  | 'a' | 'b' | 'strong' | 'i' | 'em' | 'u' | 'ins' | 's' | 'strike' | 'del' | 'span'
  | 'tg-spoiler' | 'tg-emoji' | 'tg-time' | 'code' | 'pre' | 'blockquote';

// prettier-ignore
const TG_HTML_ALLOWED_TAGS =  [
  'a', 'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'span',
  'tg-spoiler', 'tg-emoji', 'tg-time', 'code', 'pre', 'blockquote',
] as const satisfies readonly TelegramHtmlTag[];

const TG_HTML_ALLOWED_TAGS_SET = new Set<TelegramHtmlTag>(TG_HTML_ALLOWED_TAGS);
const TG_HTML_VOID_TAGS = new Set<TelegramHtmlTag>();

type AllowedHtmlInput = string | readonly TelegramHtmlTag[];

const parseAllowedHtmlTags = (
  allowed: AllowedHtmlInput = '<a><b><i><u><s><strong><pre><code>',
) => {
  if (Array.isArray(allowed)) {
    return new Set(
      allowed.filter((tag): tag is TelegramHtmlTag =>
        TG_HTML_ALLOWED_TAGS_SET.has(tag),
      ),
    );
  }

  const parsed = ((allowed || '') + '')
    .toLowerCase()
    .match(/<[a-z][a-z0-9-]*>/g)
    ?.map((x) => x.slice(1, -1))
    .filter((tag): tag is TelegramHtmlTag =>
      TG_HTML_ALLOWED_TAGS_SET.has(tag as TelegramHtmlTag),
    );

  return new Set<TelegramHtmlTag>(parsed || []);
};

const escapeHtmlText = (s: string) =>
  s
    .replace(/&(?!(?:lt|gt|amp|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getTagName = (raw: string) => {
  const m = raw.match(/^<\s*\/?\s*([a-z][a-z0-9-]*)\b/i);
  return (m?.[1]?.toLowerCase() || '') as TelegramHtmlTag | '';
};

const isClosingTag = (raw: string) => /^<\s*\//.test(raw);

const getAttr = (raw: string, name: string) => {
  const re = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>` + '`' + `]+))`,
    'i',
  );
  const m = raw.match(re);
  return m?.[2] ?? m?.[3] ?? m?.[4] ?? '';
};

const escapeHtmlAttr = (s: string) =>
  s
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&/g, '&amp;');

/** @deprecated Use `escapeHtmlAttr` */
export const escapeHTMLCodeChars = escapeHtmlAttr;

const sanitizeTelegramHtmlTag = (
  raw: string,
  allowedSet: ReadonlySet<TelegramHtmlTag>,
) => {
  const tag = getTagName(raw);
  if (!tag || !allowedSet.has(tag)) return '';

  if (isClosingTag(raw)) return `</${tag}>`;

  if (tag === 'a') {
    const href = getAttr(raw, 'href');
    return href ? `<a href="${escapeHtmlAttr(href)}">` : '';
  }

  if (tag === 'span') {
    return /\bclass\s*=\s*["']tg-spoiler["']/i.test(raw)
      ? '<span class="tg-spoiler">'
      : '';
  }

  if (tag === 'tg-emoji') {
    const emojiId = getAttr(raw, 'emoji-id');
    return emojiId ? `<tg-emoji emoji-id="${escapeHtmlAttr(emojiId)}">` : '';
  }

  if (tag === 'tg-time') {
    const unix = getAttr(raw, 'unix');
    const format = getAttr(raw, 'format');
    if (!unix) return '';
    return format
      ? `<tg-time unix="${escapeHtmlAttr(unix)}" format="${escapeHtmlAttr(format)}">`
      : `<tg-time unix="${escapeHtmlAttr(unix)}">`;
  }

  if (tag === 'code') {
    const cls = getAttr(raw, 'class');
    return cls ? `<code class="${escapeHtmlAttr(cls)}">` : '<code>';
  }

  if (tag === 'blockquote') {
    return /\bexpandable\b/i.test(raw)
      ? '<blockquote expandable>'
      : '<blockquote>';
  }

  return `<${tag}>`;
};

export const allowerHtmlTags = (
  str: string,
  allowed: AllowedHtmlInput = '<a><b><i><u><s><strong><pre><code>',
) => {
  const allowedSet = parseAllowedHtmlTags(allowed);

  str = str.replace(/&nbsp;/g, ' ');
  str = str.replace(/<\s*br\s*\/?>/gi, '\n');
  str = str.replace(/<\s*\/p\s*>/gi, '\n');
  str = str.replace(/<\s*p\b[^>]*>/gi, '');

  const tags = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
  let last = 0;
  let out = '';

  for (const m of str.matchAll(tags)) {
    const raw = m[0];
    const idx = m.index ?? 0;
    out += escapeHtmlText(str.slice(last, idx));
    out += sanitizeTelegramHtmlTag(raw, allowedSet);
    last = idx + raw.length;
  }

  out += escapeHtmlText(str.slice(last));
  return out;
};

// ** MarkDownV2
type MdV2Token = '*' | '_' | '__' | '~' | '||' | '`' | '```';

const isMdEscaped = (text: string, pos: number) => {
  let n = 0;
  for (let i = pos - 1; i >= 0 && text[i] === '\\'; i--) n++;
  return n % 2 === 1;
};

const trimDanglingMdBackslashes = (text: string) => {
  let end = text.length;
  while (end > 0) {
    let n = 0;
    for (let i = end - 1; i >= 0 && text[i] === '\\'; i--) n++;
    if (n % 2 === 0) break;
    end--;
  }
  return text.slice(0, end);
};

const stripIncompleteMdLinkTail = (text: string) => {
  const openParen = text.lastIndexOf('(');
  const closeParen = text.lastIndexOf(')');
  const openBracket = text.lastIndexOf('[');
  const closeBracket = text.lastIndexOf(']');

  if (openBracket > closeBracket) return text.slice(0, openBracket);
  if (openParen > closeParen) {
    if (openBracket !== -1 && closeBracket > openBracket)
      return text.slice(0, openBracket);
    return text.slice(0, openParen);
  }

  const bangOpenBracket = text.lastIndexOf('![');
  if (bangOpenBracket !== -1 && bangOpenBracket > closeBracket)
    return text.slice(0, bangOpenBracket);

  return text;
};

export const normalizePartialMarkdownV2 = (text: string) => {
  const input = stripIncompleteMdLinkTail(trimDanglingMdBackslashes(text));
  let out = '';
  const stack: MdV2Token[] = [];

  for (let i = 0; i < input.length; ) {
    if (input.startsWith('```', i) && !isMdEscaped(input, i)) {
      if (stack[stack.length - 1] === '```') stack.pop();
      else stack.push('```');
      out += '```';
      i += 3;
      continue;
    }

    if (
      stack[stack.length - 1] !== '```' &&
      input.startsWith('||', i) &&
      !isMdEscaped(input, i)
    ) {
      if (stack[stack.length - 1] === '||') stack.pop();
      else stack.push('||');
      out += '||';
      i += 2;
      continue;
    }

    if (
      stack[stack.length - 1] !== '```' &&
      input.startsWith('__', i) &&
      !isMdEscaped(input, i)
    ) {
      if (stack[stack.length - 1] === '__') stack.pop();
      else stack.push('__');
      out += '__';
      i += 2;
      continue;
    }

    const ch = input[i];

    if (
      ch === '`' &&
      !isMdEscaped(input, i) &&
      stack[stack.length - 1] !== '```'
    ) {
      if (stack[stack.length - 1] === '`') stack.pop();
      else stack.push('`');
      out += '`';
      i++;
      continue;
    }

    if (
      (ch === '*' || ch === '_' || ch === '~') &&
      !isMdEscaped(input, i) &&
      stack[stack.length - 1] !== '```' &&
      stack[stack.length - 1] !== '`'
    ) {
      if (stack[stack.length - 1] === ch) stack.pop();
      else stack.push(ch);
      out += ch;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  while (stack.length) out += stack.pop();

  return out;
};

// ** MarkDown

type MarkdownStackToken = '*' | '_' | '__' | '||' | '~' | '`' | '```';

// prettier-ignore
const MD_SPECIAL_CHARS = new Set([
  '\\', '_', '*', '[', ']', '(', ')', '~', '`', '>',
  '#', '+', '-', '=', '|', '{', '}', '.', '!',
]);

const isEscaped = (text: string, pos: number) => {
  let slashCount = 0;
  for (let i = pos - 1; i >= 0 && text[i] === '\\'; i--) slashCount++;
  return slashCount % 2 === 1;
};

export const normalizePartialMarkdown = (text: string) => {
  let end = text.length;

  while (end > 0 && text[end - 1] === '\\' && !isEscaped(text, end - 1)) {
    end--;
  }

  const input = text.slice(0, end);
  let out = '';
  const stack: MarkdownStackToken[] = [];

  for (let i = 0; i < input.length; ) {
    if (input.startsWith('```', i) && !isEscaped(input, i)) {
      if (stack[stack.length - 1] === '```') stack.pop();
      else stack.push('```');
      out += '```';
      i += 3;
      continue;
    }

    if (
      stack[stack.length - 1] !== '```' &&
      input.startsWith('||', i) &&
      !isEscaped(input, i)
    ) {
      if (stack[stack.length - 1] === '||') stack.pop();
      else stack.push('||');
      out += '||';
      i += 2;
      continue;
    }

    if (
      stack[stack.length - 1] !== '```' &&
      input.startsWith('__', i) &&
      !isEscaped(input, i)
    ) {
      if (stack[stack.length - 1] === '__') stack.pop();
      else stack.push('__');
      out += '__';
      i += 2;
      continue;
    }

    const ch = input[i];

    if (
      ch === '`' &&
      !isEscaped(input, i) &&
      stack[stack.length - 1] !== '```'
    ) {
      if (stack[stack.length - 1] === '`') stack.pop();
      else stack.push('`');
      out += ch;
      i++;
      continue;
    }

    if (
      (ch === '*' || ch === '_' || ch === '~') &&
      !isEscaped(input, i) &&
      stack[stack.length - 1] !== '```' &&
      stack[stack.length - 1] !== '`'
    ) {
      if (stack[stack.length - 1] === ch) stack.pop();
      else stack.push(ch);
      out += ch;
      i++;
      continue;
    }

    if (
      ch === '[' &&
      !isEscaped(input, i) &&
      stack[stack.length - 1] !== '```' &&
      stack[stack.length - 1] !== '`'
    ) {
      stack.push('[' as never);
      out += ch;
      i++;
      continue;
    }

    if (
      ch === ']' &&
      stack[stack.length - 1] === ('[' as never) &&
      !isEscaped(input, i)
    ) {
      stack.pop();
      out += ch;
      i++;
      continue;
    }

    if (
      ch === '(' &&
      !isEscaped(input, i) &&
      stack[stack.length - 1] === ('link-text-closed' as never)
    ) {
      stack.push('(' as never);
      out += ch;
      i++;
      continue;
    }

    if (
      ch === ')' &&
      stack[stack.length - 1] === ('(' as never) &&
      !isEscaped(input, i)
    ) {
      stack.pop();
      out += ch;
      i++;
      continue;
    }

    out += ch;

    if (
      ch === ']' &&
      !isEscaped(input, i) &&
      !stack.includes('(' as never) &&
      !stack.includes('[' as never) &&
      out.length >= 2
    ) {
      const lastOpen = out.lastIndexOf('[');
      if (lastOpen !== -1) {
        stack.push('link-text-closed' as never);
      }
    }

    i++;
  }

  while (stack.length) {
    const token = stack.pop() as string;

    if (token === 'link-text-closed') continue;
    if (token === ('[' as never)) {
      const lastIdx = out.lastIndexOf('[');
      if (lastIdx !== -1) out = out.slice(0, lastIdx);
      continue;
    }
    if (token === ('(' as never)) {
      const lastIdx = out.lastIndexOf('(');
      if (lastIdx !== -1) out = out.slice(0, lastIdx);
      continue;
    }

    out += token;
  }

  let trimmedEnd = out.length;
  while (trimmedEnd > 0) {
    const ch = out[trimmedEnd - 1];
    if (!MD_SPECIAL_CHARS.has(ch) || isEscaped(out, trimmedEnd - 1)) break;
    trimmedEnd--;
  }

  return out.slice(0, trimmedEnd);
};

// * Stream text
export type StreamToken = {
  start: number;
  end: number;
  visibleLen: number;
  isTag: boolean;
  text: string;
};

export const parseAllowedTags = (
  allowed = '<a><b><i><u><s><strong><pre><code>',
) =>
  new Set(
    (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).map(
      (x) => x.slice(1, -1),
    ),
  );

export const tokenizeTextChunk = (
  chunk: string,
  offset: number,
): StreamToken[] => {
  const out: StreamToken[] = [];
  const re = /\s+|[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) {
    const text = m[0];
    out.push({
      start: offset + m.index,
      end: offset + m.index + text.length,
      visibleLen: text.length,
      isTag: false,
      text,
    });
  }
  return out;
};

export const tokenizeForStream = (
  text: string,
  htmlAware = false,
): StreamToken[] => {
  if (!htmlAware) return tokenizeTextChunk(text, 0);

  const out: StreamToken[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === '<') {
      const j = text.indexOf('>', i + 1);
      if (j === -1) {
        out.push(...tokenizeTextChunk(text.slice(i), i));
        break;
      }
      const tag = text.slice(i, j + 1);
      out.push({
        start: i,
        end: j + 1,
        visibleLen: 0,
        isTag: true,
        text: tag,
      });
      i = j + 1;
      continue;
    }

    const next = text.indexOf('<', i);
    const end = next === -1 ? text.length : next;
    out.push(...tokenizeTextChunk(text.slice(i, end), i));
    i = end;
  }

  return out;
};

export const findSmartStreamPositions = (
  text: string,
  gap = 120,
  options?: {
    htmlAware?: boolean;
    minGap?: number;
  },
) => {
  const htmlAware = options?.htmlAware ?? false;
  const minGap = Math.max(1, options?.minGap ?? Math.floor(gap * 0.6));
  const tokens = tokenizeForStream(text, htmlAware);
  const positions: number[] = [];

  let visibleSinceLast = 0;
  let lastCut = 0;
  let candidate = 0;

  for (const token of tokens) {
    visibleSinceLast += token.visibleLen;

    const isBoundary =
      token.isTag ||
      /\s+$/.test(token.text) ||
      /[.,!?;:。！？]$/.test(token.text) ||
      token.end === text.length;

    if (isBoundary && token.end - lastCut >= minGap) {
      candidate = token.end;
    }

    if (visibleSinceLast >= gap) {
      const cut = candidate > lastCut ? candidate : token.end;
      if (cut > lastCut) {
        positions.push(cut);
        lastCut = cut;
        visibleSinceLast = 0;
        candidate = 0;
      }
    }
  }

  return positions;
};

export const normalizePartialHtml = (
  html: string,
  allowed: AllowedHtmlInput = '<a><b><i><u><s><strong><pre><code>',
) => {
  const allowedSet = parseAllowedHtmlTags(allowed);
  const input = html.replace(/<[^>]*$/, '');
  const tagRe = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  const stack: TelegramHtmlTag[] = [];

  while ((m = tagRe.exec(input))) {
    const raw = m[0];
    const idx = m.index;
    const safeTag = sanitizeTelegramHtmlTag(raw, allowedSet);
    const tag = getTagName(safeTag);

    out += escapeHtmlText(input.slice(last, idx));
    last = tagRe.lastIndex;

    if (!safeTag || !tag) continue;

    if (isClosingTag(safeTag)) {
      if (stack[stack.length - 1] === tag) {
        stack.pop();
        out += safeTag;
      }
      continue;
    }

    out += safeTag;
    if (!TG_HTML_VOID_TAGS.has(tag)) stack.push(tag);
  }

  out += escapeHtmlText(input.slice(last));

  for (let i = stack.length - 1; i >= 0; i--) {
    out += `</${stack[i]}>`;
  }

  return out;
};
