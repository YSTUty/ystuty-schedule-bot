import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, Update } from 'nestjs-vk';

import { delay, VkAdminGuard, VkExceptionFilter } from '@my-common';
import { IMessageContext } from '@my-interfaces/vk';

import { VkService } from '../vk.service';

type RichTextDebugVariant = 'all' | 'basic' | 'lists' | 'complex' | 'mentions';

const RICH_TEXT_SAMPLES: Record<
  Exclude<RichTextDebugVariant, 'all' | 'mentions'>,
  readonly string[]
> = {
  basic: [
    '🧪 <b>Жирный текст</b>',
    '🧪 <i>Курсивный текст</i>',
    '🧪 <u>Подчёркнутый текст</u>',
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
    /^\/debug_rich_text(?:\s+(?<variant>all|basic|lists|complex|mentions))?\s*$/i,
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
}
