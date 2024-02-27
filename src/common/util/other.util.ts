/**
 * Remove indents
 */
export const xs = (
  strings: TemplateStringsArray,
  ...expressions: any[]
): string => {
  const indent: RegExp = !strings[0].startsWith('\n')
    ? null
    : new RegExp(`\n {${strings[0].match(/\n+( *)/)[1].length}}`, 'g');
  return expressions
    .reduce(
      (acc, expr, i) => `${acc}${expr}${strings[i + 1].replace(indent, '\n')}`,
      strings[0].replace(indent, '\n'),
    )
    .replace(/^\n|\n$/g, '');
};

export const escapeHTMLCodeChars = (text: string) =>
  text.replace(/</gi, '&lt;').replace(/>/gi, '&gt;').replace(/&/gi, '&amp;');

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const allowerHtmlTags = (
  str: string,
  allowed = '<a><b><i><u><s><strong><pre><code>',
) => {
  str = str.replace(/&nbsp;/g, ' ');
  str = str.replace(/<\/?br>/g, '\n');
  str = str.includes('<p>')
    ? str
        .split('</p>')
        .slice(0, -1)
        .map((e) => e.replace('<p>', ''))
        .join('\n')
    : str;

  allowed = (
    ((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []
  ).join('');
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  str = str.replace(tags, ($0, $1) =>
    allowed.includes(`<${$1.toLowerCase()}>`) ? $0 : '',
  );
  return str;
};
