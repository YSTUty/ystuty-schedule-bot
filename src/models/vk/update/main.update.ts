import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import {
  InjectVkApi,
  Update,
  Ctx,
  HearFallback,
  Hears,
  On,
  Next,
} from 'nestjs-vk';
import { VK, APIError } from 'vk-io';
import { NextMiddleware } from 'middleware-io';

import { VkAdminGuard, VkExceptionFilter, xs } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';
import { VkHearsLocale } from '@my-common/decorator/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';

import { VkService } from '../vk.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../vk.constants';

@Update()
@UseFilters(VkExceptionFilter)
export class MainUpdate {
  private readonly logger = new Logger(MainUpdate.name);

  constructor(
    @InjectVkApi()
    private readonly vk: VK,
    private readonly vkService: VkService,
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @Hears('/admin')
  @UseGuards(new VkAdminGuard(true))
  onAdmin(@Ctx() ctx: IMessageContext) {
    ctx.send('YOUARE ADMIN');
  }

  @Hears('/broke')
  onBroke(@Ctx() ctx: IMessageContext) {
    throw new Error('Whoops');
  }

  @VkHearsLocale(LocalePhrase.RegExp_Start)
  async hearStart(@Ctx() ctx: IMessageContext) {
    if (ctx.isChat && !ctx.state.appeal) {
      return;
    }

    const msgPayload = ctx.$match[2]?.trim().split('_');
    if (msgPayload?.length > 1) {
      if (msgPayload[0] === 'g') {
        const groupNameTest = msgPayload.slice(1).join('_');
        const groupName =
          this.ystutyService.parseGroupName(groupNameTest) ||
          this.ystutyService.parseGroupName(
            Buffer.from(groupNameTest, 'base64').toString(),
          );

        if (groupName) {
          ctx.state.rejectRefGroupName = true;
          await ctx.scene.enter(SELECT_GROUP_SCENE, {
            state: { groupName },
          });
        }
      }
    }

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });

    if (!ctx.isChat && (!ctx.state.userSocial.groupName || !ctx.state.user)) {
      const keyboard = !ctx.state.user
        ? this.keyboardFactory
            .getAuth(ctx, true, !ctx.state.userSocial.groupName)
            .inline()
        : this.keyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @Hears('/profile')
  async onProfile(@Ctx() ctx: IMessageContext) {
    const { user = null } = ctx.session;
    if (!user) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      await ctx.scene.enter(AUTH_SCENE);
      return;
    }

    const keyboard = user.groupName
      ? this.keyboardFactory.getSelectGroup(ctx, user.groupName).inline()
      : null;
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Profile_Info, { user }), {
      keyboard,
    });
  }

  @Hears(['/auth', 'login', 'войти'])
  // @VkHearsLocale([
  //   LocalePhrase.Button_AuthLink,
  //   LocalePhrase.Button_AuthLink_SocialConnect,
  // ])
  onAuth(@Ctx() ctx: IMessageContext) {
    // await ctx.send(ctx.i18n.t(LocalePhrase.Page_Auth_Intro));
    ctx.scene.enter(AUTH_SCENE);
  }

  @VkHearsLocale(LocalePhrase.RegExp_Help)
  hearHelp(@Ctx() ctx: IMessageContext) {
    if (ctx.isChat && !ctx.state.appeal) {
      return;
    }

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    ctx.send(ctx.i18n.t(LocalePhrase.Page_Help), { keyboard });
  }

  @On('chat_invite_user')
  async onChatInviteUser(@Ctx() ctx: IMessageContext) {
    if (ctx.eventMemberId !== -ctx.$groupId) {
      return;
    }

    this.logger.log(
      `Bot is invited by '${ctx.senderId}' to a new conversation: '${ctx.peerId}'`,
    );

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);

    // this.vkService.parseChatTitle(ctx, title);
    if (!ctx.sessionConversation.selectedGroupName) {
      const keyboard = this.keyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @On('chat_title_update')
  async onChatTitleUpdate(@Ctx() ctx: IMessageContext) {
    this.vkService.parseChatTitle(ctx, ctx.eventText);
  }

  @On('message_event')
  // TODO: add event/action decorator
  async onMessageEvent(
    @Ctx() ctx: IMessageEventContext,
    @Next() next: NextMiddleware,
  ) {
    const phrase = ctx.eventPayload.phrase as LocalePhrase;
    if (!phrase) return next();

    switch (phrase) {
      case LocalePhrase.Button_SelectGroup: {
        const groupName = ctx.eventPayload.groupName as string;
        await ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
        await ctx.answer({ type: 'show_snackbar', text: 'Run' });
        return;
      }
      case LocalePhrase.Button_AuthLink_SocialConnect:
      case LocalePhrase.Button_AuthLink: {
        const { socialConnectLink } = ctx.session;
        if (socialConnectLink) {
          // ...
          await ctx.answer({ type: 'open_link', link: socialConnectLink });
          delete ctx.session.socialConnectLink;
        } else {
          await ctx.scene.enter(AUTH_SCENE);
          await ctx.answer({ type: 'show_snackbar', text: 'Enter' });
        }
        return;
      }
    }

    // return next();
    ctx.answer({ type: 'show_snackbar', text: '🤔 ?..' });
  }

  @Hears('/glist')
  // @UseGuards(new VkAdminGuard(true))
  onGroupsList(@Ctx() ctx: IMessageContext) {
    ctx.send(`List: ${this.ystutyService.groupNames.join(', ')}`);
  }

  @VkHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
  async hearSelectGroup(@Ctx() ctx: IMessageContext) {
    const { senderId, peerId, state } = ctx;
    const groupName = ctx.$match?.groups?.groupName;
    const withTrigger = !!ctx.$match?.groups?.trigger;

    if (ctx.isChat) {
      if (!withTrigger && !state.appeal) {
        return;
      }

      try {
        const { items } = await this.vk.api.messages.getConversationMembers({
          peer_id: peerId,
        });
        if (!items.find((e) => e.member_id === senderId).is_admin) {
          return ctx.i18n.t(LocalePhrase.Common_NoAccess);
        }
      } catch (error) {
        if (error instanceof APIError) {
          if (error.code === 917) {
            return ctx.i18n.t(LocalePhrase.Common_NoAccess);
          }
          // return ctx.i18n.t(LocalePhrase.Common_Error);
        }
        throw error;
      }
    }

    ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
  }

  @Hears(/it(.?)s boom( ?(?<state>false))?$/i)
  async hearHideStaticKeyboard(@Ctx() ctx: IMessageContext) {
    const isHide = ctx.$match?.groups?.state?.toLowerCase() !== 'false';

    if (ctx.isChat) {
      try {
        const { items } = await this.vk.api.messages.getConversationMembers({
          peer_id: ctx.peerId,
        });
        if (!items.find((e) => e.member_id === ctx.senderId).is_admin) {
          return ctx.i18n.t(LocalePhrase.Common_NoAccess);
        }
      } catch {}

      ctx.sessionConversation.hideStaticKeyboard = isHide;
    }

    if (!isHide) {
      ctx.send('Live', { sticker_id: 14144 }); // Relax
      return;
    }

    const keyboard = this.keyboardFactory.getClose(ctx);
    ctx.send('Boom', {
      sticker_id: 5574, // Boom
      keyboard,
    });
  }

  @HearFallback()
  async onHearFallback(@Ctx() ctx: IMessageContext) {
    // ...
  }
}
