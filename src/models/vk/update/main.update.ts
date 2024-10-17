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

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';
import { VkHearsLocale } from '@my-common/decorator/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';
import { UserService } from '../../user/user.service';
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
    private readonly userService: UserService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @Hears('/admin')
  @UseGuards(new VkAdminGuard(true))
  async onAdmin(@Ctx() ctx: IMessageContext) {
    await ctx.send('YOUARE ADMIN');
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
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });

    if (!ctx.isChat && (!ctx.state.userSocial.groupName || !ctx.state.user)) {
      const keyboard = !ctx.state.user
        ? this.keyboardFactory
            .getAuth(ctx, true, !ctx.state.userSocial.groupName, false)
            .inline()
        : this.keyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @Hears('/profile')
  @VkHearsLocale(LocalePhrase.Button_Profile)
  async onProfile(@Ctx() ctx: IMessageContext) {
    const { user = null } = ctx.state;
    if (!user /* || user.isRewoked */) {
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

  @Hears('/unauth')
  async onUnAuth(@Ctx() ctx: IMessageContext) {
    const { user = null, userSocial } = ctx.state;
    if (!user /*  || user.isRewoked */) {
      await ctx.send('No account');
      return;
    }

    ctx.state.noUpdateUserSocial = true;
    await this.userService.unlinkUser(userSocial);

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.send('Done', { keyboard });
  }

  @Hears('/update_profile')
  async onUpdateProfile(@Ctx() ctx: IMessageContext) {
    const { user = null, userSocial } = ctx.state;
    if (!user || user.isRewoked) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_Auth_NeedAuth));
      await ctx.scene.enter(AUTH_SCENE);
      return;
    }

    const res = await this.userService.updateUserData(userSocial);
    if (!res) {
      ctx.send('Error');
      return;
    }
    if (typeof res === 'string') {
      await ctx.send(`Fail: ${res}`);
      return;
    }
    await ctx.send('Updated');
  }

  @Hears(['/auth', 'login', 'войти'])
  // @VkHearsLocale([
  //   LocalePhrase.Button_AuthLink,
  //   LocalePhrase.Button_AuthLink_SocialConnect,
  // ])
  async onAuth(@Ctx() ctx: IMessageContext) {
    // await ctx.send(ctx.i18n.t(LocalePhrase.Page_Auth_Intro));
    await ctx.scene.enter(AUTH_SCENE);
  }

  @VkHearsLocale(LocalePhrase.RegExp_Help)
  async hearHelp(@Ctx() ctx: IMessageContext) {
    if (ctx.isChat && !ctx.state.appeal) {
      return;
    }

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Help), { keyboard });
  }

  @On('chat_invite_user')
  async onChatInviteUser(@Ctx() ctx: IMessageContext) {
    if (ctx.eventMemberId !== -ctx.$groupId) {
      return;
    }

    this.logger.log(
      `Bot is invited by '${ctx.senderId}' to a new conversation: '${ctx.peerId}'`,
    );
    if (ctx.state.conversation && ctx.state.userSocial) {
      ctx.state.conversation.invitedByUserSocialId = ctx.state.userSocial.id;
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });

    // this.vkService.parseChatTitle(ctx, title);
    if (!ctx.sessionConversation.selectedGroupName) {
      const keyboard = this.keyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @On('chat_title_update')
  async onChatTitleUpdate(@Ctx() ctx: IMessageContext) {
    if (ctx.state.conversation && ctx.eventText) {
      ctx.state.conversation.title = ctx.eventText;
    }
    await this.vkService.parseChatTitle(ctx, ctx.eventText);
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
    await ctx.answer({ type: 'show_snackbar', text: '🤔 ?..' });
  }

  @Hears('/glist')
  // @UseGuards(new VkAdminGuard(true))
  async onGroupsList(@Ctx() ctx: IMessageContext) {
    await ctx.send(
      `List groups (50 max): ${this.ystutyService.groupNames
        .slice(0, 50)
        .join(', ')}`,
    );
  }

  @Hears('/tlist')
  // @UseGuards(new VkAdminGuard(true))
  async onTeachersList(@Ctx() ctx: IMessageContext) {
    await ctx.send(
      `List teachers (50 max): ${this.ystutyService.teacherNames
        .slice(0, 50)
        .join(', ')}`,
    );
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

      if (
        !state.conversation?.invitedByUserSocialId ||
        state.conversation.invitedByUserSocialId !== state.userSocial.id
      ) {
        try {
          const { items } = await this.vk.api.messages.getConversationMembers({
            peer_id: peerId,
          });
          console.log(items);

          if (!items.find((e) => e.member_id === senderId).is_admin) {
            return ctx.i18n.t(LocalePhrase.Error_SelectGroup_OnlyAdminOrOwner);
          }
        } catch (error) {
          if (error instanceof APIError) {
            if (error.code === 917) {
              return ctx.i18n.t(LocalePhrase.Error_Bot_NotAdmin);
            }
            // return ctx.i18n.t(LocalePhrase.Common_Error);
          }
          throw error;
        }
      }
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
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
      await ctx.send('Live', { sticker_id: 14144 }); // Relax
      return;
    }

    const keyboard = this.keyboardFactory.getClose(ctx);
    await ctx.send('Boom', {
      sticker_id: 5574, // Boom
      keyboard,
    });
  }

  @HearFallback()
  async onHearFallback(@Ctx() ctx: IMessageContext) {
    // ...
  }
}
