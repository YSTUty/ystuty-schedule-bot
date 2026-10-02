import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Ctx, Hears, InjectVkApi, On, OnMessageEvent, Update } from 'nestjs-vk';

import { APIError, VK } from 'vk-io';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../schedule/schedule.service';
import { UserService } from '../../user/user.service';
import { VkGroupSelectionKeyboardFactory } from '../model/group-selection/vk-group-selection-keyboard.factory';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { AUTH_SCENE, SELECT_GROUP_SCENE } from '../vk.constants';
import { VkService } from '../vk.service';

@Update()
@UseFilters(VkExceptionFilter)
export class MainUpdate {
  private readonly logger = new Logger(MainUpdate.name);

  constructor(
    @InjectVkApi()
    private readonly vk: VK,
    private readonly vkService: VkService,
    private readonly scheduleService: ScheduleService,
    private readonly userService: UserService,
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly groupSelectionKeyboardFactory: VkGroupSelectionKeyboardFactory,
  ) {}

  @Hears('/admin')
  @UseGuards(VkAdminGuard(true))
  async onAdmin(@Ctx() ctx: IMessageContext) {
    await ctx.send('YOUARE ADMIN');
  }

  @Hears(/^\/debug_members(?:\s+(?<conversationId>\d+))?$/i)
  @UseGuards(VkAdminGuard(true))
  async onDebugConversationMembers(@Ctx() ctx: IMessageContext) {
    if (!ctx.isDM) {
      await ctx.send('Используй команду в личных сообщениях с ботом.');
      return;
    }

    const conversationId = Number(ctx.$match?.groups?.conversationId);
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      await ctx.send('Укажи номер беседы: /debug_members 1');
      return;
    }

    const groupId = ctx.$groupId;
    if (!groupId) {
      await ctx.send('Не удалось определить ID сообщества VK.');
      return;
    }

    const peerId = 2e9 + conversationId;
    let membersResult = 'не проверено';
    try {
      const { count, items } = await this.vkService.getConversationMembers(
        peerId,
        groupId,
      );
      const botMember = items.find((member) => member.member_id === -groupId);
      membersResult = botMember
        ? `успешно; участников: ${count}; member_id=${botMember.member_id}; is_admin=${Boolean(botMember.is_admin)}; is_owner=${Boolean(botMember.is_owner)}`
        : `успешно; участников: ${count}; бот не найден в ответе API`;
    } catch (error) {
      membersResult =
        error instanceof APIError
          ? `VK API Code №${error.code}: ${error.message}`
          : `ошибка: ${error instanceof Error ? error.message : String(error)}`;
    }

    this.logger.log(
      `[VK][debug][conversation-members] conversation=${conversationId} peer=${peerId} members=${membersResult}`,
    );
    await ctx.send(
      `🧪 Проверка VK members API\nconversation_id: ${conversationId}\npeer_id: ${peerId}\nСписок участников: ${membersResult}`,
    );
  }

  @Hears('/broke')
  onBroke() {
    throw new Error('Whoops');
  }

  @VkHearsLocale(LocalePhrase.RegExp_Start)
  async hearStart(@Ctx() ctx: IMessageContext) {
    if (ctx.isUnaddressedGroupMessage()) {
      return;
    }

    const msgPayload = ctx.$match[2]?.trim().split('_');
    if (msgPayload?.length > 1) {
      if (msgPayload[0] === 'g') {
        const groupNameTest = msgPayload.slice(1).join('_');
        const groupName =
          this.scheduleService.parseGroupName(groupNameTest) ||
          this.scheduleService.parseGroupName(
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

    if (ctx.isDM) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_WelcomeFeatures), {
        keyboard: this.keyboardFactory.getWelcomeFeatures(ctx).inline(),
      });
    }

    if (!ctx.isChat && (!ctx.state.userSocial.groupName || !ctx.state.user)) {
      const keyboard = !ctx.state.user
        ? this.keyboardFactory
            .getAuth(ctx, true, !ctx.state.userSocial.groupName, false)
            .inline()
        : this.groupSelectionKeyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @Hears('/invite')
  async onInvite(@Ctx() ctx: IMessageContext) {
    await ctx.send('Пригласить бота в беседу:', {
      keyboard: this.keyboardFactory.getInviteToChat(ctx).inline(),
    });
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
      ? this.groupSelectionKeyboardFactory
          .getSelectGroup(ctx, user.groupName)
          .inline()
      : undefined;
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
    if (ctx.isUnaddressedGroupMessage()) {
      return;
    }

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Help), { keyboard });
  }

  @OnMessageEvent({ mainAction: 'help' })
  async onHelpMessageEvent(@Ctx() ctx: IMessageEventContext) {
    await ctx.answer({ type: 'show_snackbar', text: 'Открываю справку' });

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Help), { keyboard });
  }

  @On('chat_invite_user')
  async onChatInviteUser(@Ctx() ctx: IMessageContext) {
    if (ctx.eventMemberId !== -ctx.$groupId!) {
      return;
    }

    const conv = ctx.state.conversation;
    if (conv && ctx.state.userSocial) {
      const previousIsLeaved = conv.isLeaved;
      conv.invitedByUserSocialId = ctx.state.userSocial.id;
      if (conv.chatStatus === 'kicked') conv.chatStatus = null;
      conv.isLeaved = false;
      this.logger.debug(
        `[VK][conversation] chat_invite_user peer=${ctx.peerId} bot=${ctx.eventMemberId} invitedBy=${ctx.senderId} isLeaved=${previousIsLeaved}->false`,
      );
    } else {
      this.logger.debug(
        `[VK][conversation] chat_invite_user peer=${ctx.peerId} bot=${ctx.eventMemberId} skipped: conversation or userSocial is absent`,
      );
    }

    const keyboard = this.keyboardFactory.getStart(ctx);
    await ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });

    // this.vkService.parseChatTitle(ctx, title);
    if (!ctx.state.conversation?.groupName) {
      const keyboard = this.groupSelectionKeyboardFactory
        .getSelectGroup(ctx)
        .inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      await ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
    }
  }

  @On('chat_kick_user')
  async onChatKickUser(@Ctx() ctx: IMessageContext) {
    if (ctx.eventMemberId !== -ctx.$groupId!) {
      return;
    }

    if (ctx.state.conversation) {
      const previousIsLeaved = ctx.state.conversation.isLeaved;
      ctx.state.conversation.isLeaved = true;
      this.logger.debug(
        `[VK][conversation] chat_kick_user peer=${ctx.peerId} bot=${ctx.eventMemberId} isLeaved=${previousIsLeaved}->true`,
      );
    } else {
      this.logger.debug(
        `[VK][conversation] chat_kick_user peer=${ctx.peerId} bot=${ctx.eventMemberId} skipped: conversation is absent`,
      );
    }
  }

  // * Только если бот администратор
  @On('chat_title_update')
  async onChatTitleUpdate(@Ctx() ctx: IMessageContext) {
    if (!ctx.eventText) {
      return;
    }
    if (ctx.state.conversation) {
      ctx.state.conversation.title = ctx.eventText;
    }
    await this.vkService.parseChatTitle(ctx, ctx.eventText);
  }

  @OnMessageEvent((payload) => 'nope' in payload)
  async onNope(@Ctx() ctx: IMessageEventContext) {
    const text = ctx.eventPayload.nope?.text;
    await ctx.answer({
      type: 'show_snackbar',
      text: text ?? 'Nope ¯\\_(ツ)_/¯',
    });
  }

  @OnMessageEvent((payload) =>
    [
      LocalePhrase.Button_AuthLink_SocialConnect,
      LocalePhrase.Button_AuthLink,
    ].includes(payload.phrase as LocalePhrase),
  )
  async onAuthLink(@Ctx() ctx: IMessageEventContext) {
    const { socialConnectLink } = ctx.session;
    if (socialConnectLink) {
      await ctx.answer({ type: 'open_link', link: socialConnectLink });
      delete ctx.session.socialConnectLink;
      return;
    }

    await ctx.scene.enter(AUTH_SCENE);
    await ctx.answer({ type: 'show_snackbar', text: 'Enter' });
  }

  @Hears(/it(.?)s boom( ?(?<state>false))?$/i)
  async hearHideStaticKeyboard(@Ctx() ctx: IMessageContext) {
    const isHide = ctx.$match?.groups?.state?.toLowerCase() !== 'false';

    if (ctx.isChat) {
      try {
        const items = await this.vkService.getCachedConvMembers(ctx.peerId);
        const member = items.find((e) => e.member_id === ctx.senderId);
        if (!member || !member.is_admin) {
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
}
