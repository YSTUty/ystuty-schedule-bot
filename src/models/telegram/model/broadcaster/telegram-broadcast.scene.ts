import {
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
};

@Wizard(TELEGRAM_BROADCAST_SCENE)
export class TelegramBroadcastScene extends BaseScene {
  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  async onEnter(@Ctx() ctx: IStepContext) {
    const state = ctx.scene.state as TelegramBroadcastState;
    state.filter = {
      hasDM: true,
      isBlockedBot: false,
    };

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
  async onNext(@Ctx() ctx: IStepContext) {
    await ctx.replyWithHTML(
      'Отправь сообщение-образец для рассылки. Оно будет разослано через copyMessage.',
      Markup.keyboard([['/cancel']]).resize(),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  @Hears(/.+/)
  async onStep2Hint(@Ctx() ctx: IStepContext) {
    await ctx.replyWithHTML('Настройки готовы. Для продолжения отправь /next.');
  }

  @WizardStep(3)
  async onMessage(@Ctx() ctx: IStepContext) {
    if (!ctx.message || !('message_id' in ctx.message) || !ctx.chat) return;

    const state = ctx.scene.state as TelegramBroadcastState;
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
        '',
        'Команды:',
        '/send - запустить рассылку',
        '/back - заменить сообщение',
        '/cancel - отменить',
      ].join('\n'),
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
    ctx.wizard.next();
  }

  @WizardStep(4)
  @Command('back')
  async onBack(@Ctx() ctx: IStepContext) {
    ctx.wizard.selectStep(2);
    await ctx.replyWithHTML('Отправь новое сообщение-образец.');
  }

  @WizardStep(4)
  @Command('send')
  async onSend(@Ctx() ctx: IStepContext) {
    const state = ctx.scene.state as TelegramBroadcastState;
    if (!state.sourceMessage) {
      ctx.wizard.selectStep(2);
      await ctx.replyWithHTML('Сначала отправь сообщение-образец.');
      return;
    }

    const campaign = await this.broadcastService.createAndQueueCampaign({
      social: SocialType.Telegram,
      mode: BroadcastMessageMode.Copy,
      sourceMessage: state.sourceMessage,
      audienceFilter: state.filter,
      createdBySocialId: ctx.from?.id,
    });

    await ctx.replyWithHTML(
      `Рассылка #${campaign.id} поставлена в очередь. Получателей: <code>${campaign.totalCount}</code>`,
      this.keyboardFactory.getStart(ctx),
    );
    await this.leaveScene(ctx);
  }

  @WizardStep(4)
  async onStep4Fallback(@Ctx() ctx: IStepContext) {
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
      '',
      'Для продолжения отправь /next.',
    ].join('\n');
  }

  private getSettingsKeyboard() {
    return Markup.keyboard([['/next'], ['/cancel']]).resize();
  }
}
