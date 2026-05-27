import {
  Action,
  Command,
  Ctx,
  Hears,
  Wizard,
  WizardStep,
} from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';

import { SocialType } from '@my-common/constants';
import { IStepContext } from '@my-interfaces/telegram';

import { TELEGRAM_BROADCAST_SCENE } from '../../../broadcast/broadcast.constants';
import { BroadcastService } from '../../../broadcast/broadcast.service';
import {
  BroadcastAudienceFilter,
  BroadcastMessageMode,
  BroadcastSourceMessage,
} from '../../../broadcast/broadcast.types';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

type TelegramBroadcastState = {
  filter: BroadcastAudienceFilter;
  sourceMessage?: BroadcastSourceMessage;
  recipientsCount?: number;
  mode: BroadcastMessageMode.Copy | BroadcastMessageMode.Forward;
};

type IStepCtx = IStepContext<TelegramBroadcastState>;

@Wizard(TELEGRAM_BROADCAST_SCENE)
export class TelegramBroadcastScene extends BaseScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  async onEnter(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.filter = {
      hasDM: true,
      isBlockedBot: false,
    };
    state.mode = BroadcastMessageMode.Copy;

    const count = await this.broadcastService.countRecipients(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = count;

    await ctx.replyWithHTML(
      this.renderSettings(state),
      this.getSettingsKeyboard(),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Command('next')
  async onNext(@Ctx() ctx: IStepCtx) {
    await ctx.replyWithHTML(
      'Отправь сообщение-образец для рассылки. Оно будет разослано через copyMessage.',
      Markup.keyboard([['/cancel']]).resize(),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Hears(/.+/)
  async onStep2Hint(@Ctx() ctx: IStepCtx) {
    await ctx.replyWithHTML('Настройки готовы. Для продолжения отправь /next.');
  }

  @WizardStep(3)
  async onMessage(@Ctx() ctx: IStepCtx) {
    if (!ctx.message || !('message_id' in ctx.message) || !ctx.chat) return;

    const state = ctx.scene.state;
    state.sourceMessage = {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
    };

    const count = await this.broadcastService.countRecipients(
      SocialType.Telegram,
      state.filter,
    );
    state.recipientsCount = count;

    await ctx.replyWithHTML(
      [
        '<b>Рассылка готова к запуску</b>',
        `Получателей: <code>${count}</code>`,
        `Режим: <code>${state.mode}</code>`,
        '',
        'Команды:',
        '/send - запустить рассылку',
        '/back - заменить сообщение',
        '/cancel - отменить',
      ].join('\n'),
      {
        reply_parameters: { message_id: ctx.message.message_id },
        ...this.getConfirmKeyboard(state),
      },
    );
    ctx.wizard.next();
  }

  @WizardStep(4)
  @Command('back')
  async onBack(@Ctx() ctx: IStepCtx) {
    ctx.wizard.selectStep(2);
    await ctx.replyWithHTML('Отправь новое сообщение-образец.');
  }

  @WizardStep(4)
  @Command('send')
  @Action('broadcast:wizard:send')
  async onSend(@Ctx() ctx: IStepCtx) {
    await ctx.tryAnswerCbQuery();

    const state = ctx.scene.state;
    if (!state.sourceMessage) {
      ctx.wizard.selectStep(2);
      await ctx.replyWithHTML('Сначала отправь сообщение-образец.');
      return;
    }

    const campaign = await this.broadcastService.createAndQueueCampaign({
      social: SocialType.Telegram,
      mode: state.mode,
      sourceMessage: state.sourceMessage,
      audienceFilter: state.filter,
      createdBySocialId: ctx.from?.id,
    });

    if (ctx.callbackQuery?.message) {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }

    const queuedMessage = await ctx.replyWithHTML(
      `Рассылка #${campaign.id} поставлена в очередь. Получателей: <code>${campaign.totalCount}</code>`,
      this.keyboardFactory.getBroadcastQueueControls(true),
    );
    await this.broadcastService.updateCampaignSourceMessage(campaign.id, {
      ...campaign.sourceMessage,
      reportMessage: {
        chatId: queuedMessage.chat.id,
        messageId: queuedMessage.message_id,
      },
    });
    await this.leaveScene(ctx);
  }

  @WizardStep(4)
  @Action(/broadcast:wizard:mode:(?<mode>copy|forward)/)
  async onModeToggle(@Ctx() ctx: IStepCtx) {
    const state = ctx.scene.state;
    state.mode =
      ctx.match!.groups!.mode === BroadcastMessageMode.Forward
        ? BroadcastMessageMode.Forward
        : BroadcastMessageMode.Copy;

    await ctx.tryAnswerCbQuery(`Режим: ${state.mode}`);
    await ctx.editMessageText(
      [
        '<b>Рассылка готова к запуску</b>',
        `Получателей: <code>${state.recipientsCount ?? 0}</code>`,
        `Режим: <code>${state.mode}</code>`,
        '',
        'Команды:',
        '/send - запустить рассылку',
        '/back - заменить сообщение',
        '/cancel - отменить',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        ...this.getConfirmKeyboard(state),
      },
    );
  }

  @WizardStep(4)
  async onStep4Fallback(@Ctx() ctx: IStepCtx) {
    await ctx.replyWithHTML('Для запуска рассылки отправь /send.');
  }

  private renderSettings(state: TelegramBroadcastState): string {
    return [
      '<b>Настройки Telegram-рассылки</b>',
      `Получателей сейчас: <code>${state.recipientsCount ?? 0}</code>`,
      '',
      'Фильтры первой версии:',
      '• social = telegram',
      `• hasDM = ${state.filter.hasDM}`,
      `• isBlockedBot = ${state.filter.isBlockedBot}`,
      `• mode = ${state.mode ?? BroadcastMessageMode.Copy}`,
      '',
      'Для продолжения отправь /next.',
    ].join('\n');
  }

  private getSettingsKeyboard() {
    return Markup.keyboard([['/next'], ['/cancel']]).resize();
  }

  private getConfirmKeyboard(state: TelegramBroadcastState) {
    return this.keyboardFactory.getBroadcastConfirm(state.mode);
  }
}
