import {
  htmlToFormattable,
  normalizeVkMentionEntities,
  type VkFormatEntity,
} from './vk-html-text.util';

describe('htmlToFormattable', () => {
  it('converts nested HTML styles and links to VK format_data', () => {
    const result = htmlToFormattable(
      '<b>Hello <a href="https://ystuty.ru"><i>world</i></a></b>',
    );

    expect(result.fmt).toEqual({
      text: 'Hello world',
      entities: [
        { type: 'bold', offset: 0, length: 11 },
        { type: 'text_link', offset: 6, length: 5, url: 'https://ystuty.ru' },
        { type: 'italic', offset: 6, length: 5 },
      ],
    });
    expect(JSON.parse(result.extraParams.format_data)).toEqual({
      version: '1',
      items: [
        { type: 'bold', offset: 0, length: 11 },
        { type: 'url', offset: 6, length: 5, url: 'https://ystuty.ru' },
        { type: 'italic', offset: 6, length: 5 },
      ],
    });
  });

  it('preserves list items and nested list content as plain VK text', () => {
    const result = htmlToFormattable(
      '<ol start="3"><li>third</li><li>fourth<ul><li>nested</li></ul></li></ol>',
    );

    expect(result.extraParams.message).toBe('3. third\n4. fourth\n- nested');
  });

  it('keeps unsupported VK rich-text tags as plain text', () => {
    const result = htmlToFormattable(
      '<s>old</s> <code>answer()</code> <pre><code class="language-ts">const a = 1;</code></pre> <blockquote>quote</blockquote>',
    );

    expect(result.extraParams.message).toBe('old answer() const a = 1; quote');
    expect(JSON.parse(result.extraParams.format_data).items).toEqual([]);
  });

  it('preserves supported entities across paragraphs, newlines and special characters', () => {
    const result = htmlToFormattable(
      [
        '<b>Заголовок: «Расписание &amp; пары»</b>',
        '<i>Курсив с символами: &lt;текст&gt;, №1, 50%.</i>',
        '<u>Подчёркнутая строка\nс переносом</u>',
        '<a href="https://view.ystuty.ru/g/%D0%A1%D0%90%D0%A0-34/?test&amp;week=3">Ссылка: САР-34 (неделя 3)</a>',
        '<b>Внешний <i>курсив и <u>подчёркивание</u></i></b>.',
      ].join('\n\n'),
    );
    const { message } = result.extraParams;
    const { items } = JSON.parse(result.extraParams.format_data) as {
      items: VkFormatEntity[];
    };

    expect(message).toContain('Заголовок: «Расписание & пары»');
    expect(message).toContain('Курсив с символами: <текст>, №1, 50%.');
    expect(message).toContain('Подчёркнутая строка\nс переносом');
    expect(message).toContain('Ссылка: САР-34 (неделя 3)');
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'bold', offset: 0 }),
        expect.objectContaining({ type: 'italic' }),
        expect.objectContaining({ type: 'underline' }),
        expect.objectContaining({
          type: 'url',
          offset: message.indexOf('Ссылка: САР-34 (неделя 3)'),
          url: 'https://view.ystuty.ru/g/%D0%A1%D0%90%D0%A0-34/?test&week=3',
        }),
      ]),
    );
  });
});

describe('normalizeVkMentionEntities', () => {
  it('recalculates an entity that spans a VK bracket mention', () => {
    const text = 'До [id123|Админ] после';

    expect(
      normalizeVkMentionEntities(text, [
        { type: 'bold', offset: 0, length: text.length },
      ]),
    ).toEqual([{ type: 'bold', offset: 0, length: 10 }]);
  });

  it('moves an entity after a VK @ mention to the client offset', () => {
    const text = '@id123 ссылка';

    expect(
      normalizeVkMentionEntities(text, [
        { type: 'url', offset: 7, length: 6, url: 'https://ystuty.ru' },
      ]),
    ).toEqual([
      { type: 'url', offset: 2, length: 6, url: 'https://ystuty.ru' },
    ]);
  });
});
