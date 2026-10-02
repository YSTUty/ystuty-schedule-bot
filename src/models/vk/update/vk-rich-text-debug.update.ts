import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-vk';

import type { VkMarkdownPipeline } from 'markdown-to-vk';

import { delay, VkAdminGuard, VkExceptionFilter } from '@my-common';
import { IMessageContext } from '@my-interfaces/vk';

import { VkService } from '../vk.service';

type RichTextDebugVariant =
  | 'all'
  | 'basic'
  | 'lists'
  | 'complex'
  | 'markdown'
  | 'markdown_full'
  | 'mentions';

const RICH_TEXT_SAMPLES: Record<
  Exclude<
    RichTextDebugVariant,
    'all' | 'markdown' | 'markdown_full' | 'mentions'
  >,
  readonly string[]
> = {
  basic: [
    '🧪 <b>Жирный текст</b>',
    '🧪 <i>Курсивный текст</i>',
    '🧪 <u>Подчёркнутый текст</u>',
    '🧪 <s>Зачёркнутый текст</s>',
    '🧪 <a href="https://ystuty.ru">Ссылка YSTUty</a>',
    '🧪 <b>Жирный <i>курсив</i></b> и <a href="https://vk.com"><b>жирная ссылка</b></a>.',
  ],
  lists: [
    [
      '<b>🧪 Список</b>',
      '<ul><li>первый <i>пункт</i></li><li>второй пункт<ul><li>вложенный пункт</li></ul></li></ul>',
      '<ol start="3"><li>третий</li><li>четвёртый</li></ol>',
    ].join('\n'),
  ],
  complex: [
    [
      '<b>🧪 Большой пример: «Расписание &amp; уведомления»</b>',
      '',
      '<i>Курсив с символами: &lt;текст&gt;, №1, 50%, кавычки «ёлочки».</i>',
      '<u>Подчёркнутая строка с переносом:',
      'вторая строка того же фрагмента.</u>',
      '',
      '<a href="https://view.ystuty.ru/g/%D0%A1%D0%90%D0%A0-34/?test&amp;week=3">Ссылка: САР-34 (неделя 3)</a>',
      'Обычный текст: (скобки), [квадратные], *звёздочка*, _нижнее подчёркивание_.',
      '<b>Внешний <i>курсив и <u>подчёркивание</u></i></b>.',
    ].join('\n'),
  ],
};

const MARKDOWN_TO_VK_SAMPLES = [
  '**🧪 Markdown: жирный текст**',
  '_🧪 Markdown: курсивный текст_',
  '***🧪 Markdown: жирный курсив***',
  '[🧪 Markdown: ссылка на YSTUty](https://ystuty.ru/schedule?group=%D0%A1%D0%90%D0%A0-34&week=3)',
  '# 🧪 Markdown: заголовок',
  '> 🧪 Markdown: цитата',
  '> 🧪 Markdown: цитата с **жирным** и _курсивом_.',
  '`🧪 Markdown: код остаётся текстом`',
  '- [ ] 🧪 Markdown: задача\n- [x] 🧪 Markdown: готово',
  '| День | Пара |\n| --- | --- |\n| Среда | 5 |',
  '**🧪 Markdown: внешнее _вложенное_ форматирование**',
  '[🧪 Markdown: **жирная ссылка**](https://ystuty.ru)',
];

/** Один большой mixed-case для проверки совместимости всех правил в chunk. */
const MARKDOWN_TO_VK_FULL_SAMPLE = [
  '# 🧪 Большой Markdown → VK',
  '',
  '**Жирный**, _курсив_, ***жирный курсив*** и [ссылка на расписание](https://view.ystuty.ru/g/%D0%A1%D0%90%D0%A0-34/?week=3&source=vk).',
  'Текст со спецсимволами: «ёлочки», <тег>, [скобки], 50%, №42, emoji 📘.',
  '',
  '> Цитата с **жирным фрагментом** и _курсивным фрагментом_.',
  '> Вторая строка цитаты без вложенного стиля.',
  '',
  '- [ ] Проверить расписание на завтра',
  '- [x] Открыть календарь',
  '',
  '| День | Пара | Аудитория |',
  '| --- | --- | --- |',
  '| Среда | 5 | Точка кипения |',
  '| Четверг | 2 | 314 |',
  '',
  '---',
  '',
  '`Код остаётся обычным текстом с обратными кавычками.`',
  '**Внешний _вложенный курсив_ и [жирная ссылка](https://ystuty.ru).**',
].join('\n');

type MarkdownToVkModule = {
  createMarkdownToVkPipeline(): VkMarkdownPipeline;
};

let markdownToVkModulePromise: Promise<MarkdownToVkModule> | undefined;

/**
 * Проект собран в CommonJS, а markdown-to-vk опубликован только как ESM.
 * `new Function` сохраняет нативный `import()`: TypeScript иначе заменил бы
 * его на require(), который ESM-пакет загрузить не может.
 */
function loadMarkdownToVk(): Promise<MarkdownToVkModule> {
  const importEsm = new Function('moduleName', 'return import(moduleName)') as (
    moduleName: string,
  ) => Promise<MarkdownToVkModule>;

  markdownToVkModulePromise ??= importEsm('markdown-to-vk');
  return markdownToVkModulePromise;
}

function getMentionSample(ctx: IMessageContext) {
  const userMention = `[id${ctx.senderId}|Администратор]`;
  const groupMention = ctx.$groupId
    ? `[club${ctx.$groupId}|Сообщество]`
    : userMention;

  return [
    `🧪 ${userMention} <u>подчёркивание после bracket mention</u>.`,
    `🧪 <b>${userMention}</b> — жирное обращение.`,
    `🧪 <i>@id${ctx.senderId}</i> — курсивное @-обращение.`,
    `🧪 ${groupMention} <a href="https://ystuty.ru">ссылка после обращения</a>.`,
  ];
}

@Update()
@UseFilters(VkExceptionFilter)
@UseGuards(VkAdminGuard(true))
export class VkRichTextDebugUpdate {
  private readonly logger = new Logger(VkRichTextDebugUpdate.name);

  constructor(private readonly vkService: VkService) {}

  @Hears(
    /^\/debug_rich_text(?:\s+(?<variant>all|basic|lists|complex|markdown|markdown_full|mentions))?\s*$/i,
  )
  async onDebugRichText(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) {
      await ctx.send(
        'Проверка форматирования доступна только в личных сообщениях.',
      );
      return;
    }

    const variant =
      (ctx.$match?.groups?.variant?.toLowerCase() as RichTextDebugVariant) ??
      'all';
    if (variant === 'markdown' || variant === 'markdown_full') {
      await this.sendMarkdownToVkSample(ctx, variant === 'markdown_full');
      return;
    }

    const samples =
      variant === 'all'
        ? [...Object.values(RICH_TEXT_SAMPLES).flat(), ...getMentionSample(ctx)]
        : variant === 'mentions'
          ? getMentionSample(ctx)
          : RICH_TEXT_SAMPLES[variant];

    this.logger.debug(
      `[VK][debug][rich-text] peer=${ctx.peerId} variant=${variant} samples=${samples.length}`,
    );

    for (const sample of samples) {
      await this.vkService.sendMessageHtml(ctx.peerId, sample);
      await delay(600);
    }
  }

  private async sendMarkdownToVkSample(
    ctx: IMessageContext,
    fullSample = false,
  ) {
    const { createMarkdownToVkPipeline } = await loadMarkdownToVk();
    const pipeline = createMarkdownToVkPipeline();
    const samples = fullSample
      ? [MARKDOWN_TO_VK_FULL_SAMPLE]
      : MARKDOWN_TO_VK_SAMPLES;
    let totalChunks = 0;

    for (const [sampleIndex, sample] of samples.entries()) {
      const chunks = pipeline.render(sample);
      totalChunks += chunks.length;
      this.logger.debug(
        `[VK][debug][rich-text] peer=${ctx.peerId} variant=${fullSample ? 'markdown_full' : 'markdown'} sample=${sampleIndex + 1}/${samples.length} chunks=${chunks.length}`,
      );

      for (const chunk of chunks) {
        await this.vkService.sendMessageFormatData(
          ctx.peerId,
          chunk.text,
          chunk.items,
        );
        await delay(600);
      }
    }

    this.logger.debug(
      `[VK][debug][rich-text] peer=${ctx.peerId} variant=${fullSample ? 'markdown_full' : 'markdown'} completed chunks=${totalChunks}`,
    );
  }
}
