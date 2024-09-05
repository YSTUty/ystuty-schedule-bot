import { UseFilters } from '@nestjs/common';
import { Scene, AddStep, Ctx } from 'nestjs-vk';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';
import * as xEnv from '@my-environment';
import { SocialType, UserException, VkExceptionFilter } from '@my-common';

import { SocialConnectService } from '../../social-connect/social-connect.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { AUTH_SCENE } from '../vk.constants';

@Scene(AUTH_SCENE)
@UseFilters(VkExceptionFilter)
export class AuthScene {
  constructor(
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly socialConnectService: SocialConnectService,
  ) {}

  @AddStep()
  async step1(@Ctx() ctx: IStepContext<{ groupName: string }>) {
    if (!ctx.isDM && !ctx.is(['message_event'])) {
      await ctx.scene.leave({ canceled: true });
      return;
    }

    if (!this.socialConnectService.isAvailable) {
      await ctx.send('Not work');
      await ctx.scene.leave({ canceled: true });
      return;
    }

    if (ctx.state.user) {
      await ctx.send('Already auth');
      await ctx.scene.leave({ canceled: true });
      return;
    }

    const result = await this.socialConnectService.requestAuth(
      SocialType.Vkontakte,
      ctx.peerId,
    );

    if ('error' in result) {
      throw new UserException(result.error);
    }

    if (result.status === 'unauth') {
      const link = `https://vk.me/${result.botName}?ref=${result.payload}&ref_source=${xEnv.SOCIAL_VK_GROUP_ID}`;
      ctx.session.socialConnectLink = link;
      const keyboard = this.keyboardFactory.getAuth(ctx).inline();
      await ctx.send(
        ctx.i18n.t(LocalePhrase.Page_SocialConnect_NeedConnect, {
          botName: result.botName,
        }),
        { keyboard },
      );
      return;
    }

    const message =
      result.status === 'auth'
        ? LocalePhrase.Page_SocialConnect_WaitConfirm
        : result.status === 'process'
        ? LocalePhrase.Page_SocialConnect_AlreadySent
        : LocalePhrase.Page_SocialConnect_Other;

    await ctx.send(ctx.i18n.t(message, { botName: result.botName }));
  }
}
