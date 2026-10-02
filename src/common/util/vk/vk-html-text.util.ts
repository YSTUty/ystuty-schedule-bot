import { type HTMLElement, type Node, parse } from 'node-html-parser';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export type VkFormatEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
  [key: string]: unknown;
};

export type VkFormattableString = {
  text: string;
  entities: VkFormatEntity[];
};

export type VkHtmlMessage = {
  fmt: VkFormattableString;
  extraParams: {
    message: string;
    format_data: string;
  };
};

const plain = (text: string): VkFormattableString => ({ text, entities: [] });

/** Склеивает фрагменты и переносит offsets сущностей в итоговую строку. */
function join(parts: readonly VkFormattableString[]): VkFormattableString {
  let offset = 0;
  const text: string[] = [];
  const entities: VkFormatEntity[] = [];

  for (const part of parts) {
    text.push(part.text);
    entities.push(
      ...part.entities.map((entity) => ({
        ...entity,
        offset: entity.offset + offset,
      })),
    );
    offset += part.text.length;
  }

  return { text: text.join(''), entities };
}

function withEntity(
  type: string,
  value: VkFormattableString,
  extra: Omit<VkFormatEntity, 'type' | 'offset' | 'length'> = {},
): VkFormattableString {
  if (!value.text) return value;

  return {
    text: value.text,
    entities: [
      { type, offset: 0, length: value.text.length, ...extra },
      ...value.entities,
    ],
  };
}

function joinChildren(el: HTMLElement): VkFormattableString {
  return join(
    el.childNodes
      .map(processNode)
      .filter((node): node is VkFormattableString => Boolean(node)),
  );
}

function processListNode(
  el: HTMLElement,
  ordered: boolean,
  startNumber = 1,
): VkFormattableString {
  const directItems = el.childNodes.filter(
    (node): node is HTMLElement =>
      node.nodeType === ELEMENT_NODE && (node as HTMLElement).tagName === 'LI',
  );

  return join(
    directItems.flatMap((item, itemIndex) => {
      const bullet = ordered ? `${startNumber + itemIndex}.` : '-';
      const contentNodes: Node[] = [];
      const nestedLists: HTMLElement[] = [];

      for (const child of item.childNodes) {
        if (child.nodeType === ELEMENT_NODE) {
          const tag = (child as HTMLElement).tagName;
          if (tag === 'UL' || tag === 'OL') {
            nestedLists.push(child as HTMLElement);
            continue;
          }
        }
        contentNodes.push(child);
      }

      const content = join(
        contentNodes
          .map(processNode)
          .filter((node): node is VkFormattableString => Boolean(node)),
      );
      const result: VkFormattableString[] = [plain(`${bullet} `), content];

      for (const nested of nestedLists) {
        const isOrdered = nested.tagName === 'OL';
        const nestedStart = isOrdered
          ? Number(nested.getAttribute('start') ?? '1')
          : 1;
        result.push(plain('\n'));
        result.push(processListNode(nested, isOrdered, nestedStart));
      }

      if (itemIndex < directItems.length - 1) {
        result.push(plain('\n'));
      }
      return result;
    }),
  );
}

function processTextNode(node: Node): VkFormattableString | null {
  const text = node.text.replace(/\r\n/g, '\n');
  return text ? plain(text) : null;
}

function processNode(node: Node): VkFormattableString | null {
  if (node.nodeType === TEXT_NODE) {
    return processTextNode(node);
  }
  if (node.nodeType !== ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName;

  switch (tag) {
    case 'STRONG':
    case 'B':
      return withEntity('bold', joinChildren(el));
    case 'EM':
    case 'I':
      return withEntity('italic', joinChildren(el));
    case 'U':
      return withEntity('underline', joinChildren(el));
    case 'S':
    case 'DEL':
    case 'STRIKE':
      // VK API принимает `strike`, но актуальные клиенты его не отображают.
      return joinChildren(el);
    case 'CODE':
      return plain(el.text);
    case 'PRE':
      return plain(el.text);
    case 'BLOCKQUOTE':
      return joinChildren(el);
    case 'A':
      return withEntity('text_link', joinChildren(el), {
        url: el.getAttribute('href') ?? '',
      });
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return withEntity('bold', joinChildren(el));
    case 'P':
    case 'DIV':
    case 'LI':
      return joinChildren(el);
    case 'BR':
      return plain('\n');
    case 'UL':
      return processListNode(el, false);
    case 'OL':
      return processListNode(el, true, Number(el.getAttribute('start') ?? '1'));
    default:
      return joinChildren(el);
  }
}

// Иначе <pre> становится текстовым узлом и вложенный <code> с language-* не виден.
const PARSE_OPTIONS = {
  blockTextElements: { script: true, style: true, noscript: true },
};

function cloneEntities(entities: readonly VkFormatEntity[]): VkFormatEntity[] {
  return entities.map((entity) => ({ ...entity }));
}

/**
 * VK применяет format_data последовательно. Охватывающая сущность должна идти
 * раньше вложенной: некоторые внешние Markdown-конвертеры возвращают их в
 * обратном порядке, из-за чего клиент молча игнорирует всё форматирование.
 */
export function sortVkFormatEntities(
  entities: readonly VkFormatEntity[],
): VkFormatEntity[] {
  return cloneEntities(entities).sort(
    (left, right) => left.offset - right.offset || right.length - left.length,
  );
}

/**
 * Убирает внутренний повтор того же стиля. Например, markdown quote добавляет
 * italic на всю строку, а `_фрагмент_` внутри создаёт ещё один italic range.
 * VK игнорирует весь format_data при таком пересечении одинаковых типов.
 */
export function removeNestedDuplicateVkFormatEntities(
  entities: readonly VkFormatEntity[],
): VkFormatEntity[] {
  const sorted = sortVkFormatEntities(entities);

  return sorted.filter(
    (entity, entityIndex) =>
      !sorted.slice(0, entityIndex).some((outerEntity) => {
        const outerEnd = outerEntity.offset + outerEntity.length;
        const entityEnd = entity.offset + entity.length;

        return (
          outerEntity.type === entity.type &&
          outerEntity.offset <= entity.offset &&
          outerEnd >= entityEnd
        );
      }),
  );
}

function parseVkMentionMatch(text: string): RegExpMatchArray | null {
  const bracketMentionRe =
    /\B\[((id|club|event|public)\d+|[A-Za-z0-9_.]{2,32})\|[^\]\n<]+\]/;
  const mentionWithTextRe =
    /\B[@*](((id|club|event|public)\d+)|[a-z_\-\d]+)\s*\(.+?\)/i;
  const mentionRe = /\B[@*](((id|club|event|public)\d+)|[a-z_\-\d]+)/i;

  return (
    [
      text.match(bracketMentionRe),
      text.match(mentionWithTextRe),
      text.match(mentionRe),
    ]
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0] ?? null
  );
}

/**
 * VK client сворачивает распознанные mention-конструкции в один символ до
 * применения format_data. Поэтому сущности, идущие после @name/[id|name],
 * требуют пересчёта смещений на клиентское представление текста.
 */
export function normalizeVkMentionEntities(
  text: string,
  entities: readonly VkFormatEntity[],
): VkFormatEntity[] {
  let normalizedText = text;
  const normalizedEntities = cloneEntities(entities);
  let mention = parseVkMentionMatch(normalizedText);

  while (mention && typeof mention.index === 'number') {
    const mentionText = mention[0];
    const mentionStart = mention.index;
    const mentionEnd = mentionStart + mentionText.length;
    const diff = mentionText.length - 1;

    for (const entity of normalizedEntities) {
      const entityStart = entity.offset;
      const entityEnd = entity.offset + entity.length;

      if (entityStart <= mentionStart && entityEnd >= mentionEnd) {
        entity.length -= diff;
      } else if (
        entityStart < mentionStart &&
        entityEnd > mentionStart &&
        entityEnd <= mentionEnd
      ) {
        entity.length = mentionStart - entityStart;
      } else if (entityStart >= mentionStart && entityEnd <= mentionEnd) {
        entity.offset = 0;
        entity.length = 0;
      } else if (
        entityStart >= mentionStart &&
        entityStart < mentionEnd &&
        entityEnd > mentionEnd
      ) {
        entity.offset = mentionEnd;
        entity.length = entityEnd - mentionEnd;
      }

      if (entity.offset >= mentionEnd) {
        entity.offset -= diff;
      }
    }

    normalizedText =
      normalizedText.slice(0, mentionStart) +
      '1' +
      normalizedText.slice(mentionEnd);
    mention = parseVkMentionMatch(normalizedText);
  }

  return normalizedEntities.filter(
    (entity) => entity.offset >= 0 && entity.length > 0,
  );
}

/** Преобразует доверенный HTML в plain text и неофициальный VK format_data. */
export function htmlToFormattable(html: string): VkHtmlMessage {
  const root = parse(html, PARSE_OPTIONS);
  const fmt = join(
    root.childNodes
      .map(processNode)
      .filter((node): node is VkFormattableString => Boolean(node)),
  );
  const items = normalizeVkMentionEntities(
    fmt.text,
    fmt.entities.map((entity) =>
      entity.type === 'text_link' ? { ...entity, type: 'url' } : entity,
    ),
  );

  return {
    fmt,
    extraParams: {
      message: fmt.text,
      format_data: JSON.stringify({
        version: '1',
        items: removeNestedDuplicateVkFormatEntities(items),
      }),
    },
  };
}
