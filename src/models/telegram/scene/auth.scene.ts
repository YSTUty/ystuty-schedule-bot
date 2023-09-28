import { Action, Ctx, Hears, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';
import { SocialType, UserException } from '@my-common';

import { SocialConnectService } from '../../social-connect/social-connect.service';
import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { AUTH_SCENE } from '../telegram.constants';
import { BaseScene } from './base.scene';

@Wizard(AUTH_SCENE)
export class AuthScene extends BaseScene {
  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly socialConnectService: SocialConnectService,
  ) {
    super();
  }

  @WizardStep(1)
  @Hears(/.+/)
  @Action(/.+/)
  async step1(@Ctx() ctx: IStepContext) {
    const {
      scene: { state },
    } = ctx;

    if (!ctx.chat) {
      return;
    }

    const firstTime = state.firstTime !== false;
    state.firstTime = false;

    if (firstTime) {
      //
    }

    if (!this.socialConnectService.isAvailable) {
      ctx.replyWithHTML('Not work');
      await ctx.scene.leave();
      return;
    }

    if (ctx.user) {
      ctx.replyWithHTML('Already auth');
      await ctx.scene.leave();
      return;
    }

    const result = await this.socialConnectService.requestAuth(
      SocialType.Telegram,
      ctx.from.id,
    );

    if ('error' in result) {
      throw new UserException(result.error);
    }

    if (result.status === 'unauth') {
      const link = `https://t.me/${result.botName}?start=${result.payload}`;
      const keyboard = this.keyboardFactory.getAuth(
        ctx,
        true,
        true,
        false,
        link,
      );
      ctx.replyWithHTML(
        ctx.i18n.t(LocalePhrase.Page_SocialConnect_NeedConnect, {
          botName: result.botName,
        }),
        keyboard,
      );
      return;
    }

    const message =
      result.status === 'auth'
        ? LocalePhrase.Page_SocialConnect_WaitConfirm
        : result.status === 'process'
        ? LocalePhrase.Page_SocialConnect_AlreadySent
        : LocalePhrase.Page_SocialConnect_Other;

    ctx.replyWithHTML(ctx.i18n.t(message, { botName: result.botName }));
  }
}
