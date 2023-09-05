import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { InjectVkApi, Update, Ctx, HearFallback, Hears, On } from 'nestjs-vk';
import { VK, APIError } from 'vk-io';

import { VkAdminGuard, VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';
import { VkHearsLocale } from '@my-common/decorator/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';

import { VkService } from '../vk.service';
import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Update()
@UseFilters(VkExceptionFilter)
export class VkUpdate {
  private readonly logger = new Logger(VkUpdate.name);

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

    if (!ctx.session.selectedGroupName) {
      const keyboard = this.keyboardFactory.getSelectGroup(ctx).inline();
      const useInline = ctx.clientInfo.inline_keyboard;
      ctx.send(ctx.i18n.t(LocalePhrase.Page_InitBot, { useInline }), {
        keyboard,
      });
      return;
    }

    const keyboard = this.keyboardFactory
      .getStart(ctx)
      .inline(this.keyboardFactory.needInline(ctx));
    ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });
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
  async onMessageEvent(@Ctx() ctx: IMessageEventContext) {
    const phrase = ctx.eventPayload.phrase as LocalePhrase;
    if (!phrase) return;

    switch (phrase) {
      case LocalePhrase.Button_SelectGroup: {
        ctx.scene.enter(SELECT_GROUP_SCENE);
        ctx.answer({ type: 'show_snackbar', text: 'Run' });
        return;
      }
    }

    ctx.answer({ type: 'show_snackbar', text: '🤔 ?..' });
  }

  @Hears('/glist')
  // @UseGuards(new VkAdminGuard(true))
  onGroupsList(@Ctx() ctx: IMessageContext) {
    ctx.send(`List: ${this.ystutyService.groupNames.join(', ')}`);
  }

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
  ])
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    const session = !ctx.isChat ? ctx.session : ctx.sessionConversation;

    const groupNameFromMath = ctx.$match?.groups?.groupName;
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromMath ||
        ctx.messagePayload?.groupName ||
        session.selectedGroupName,
    );

    const _skipDays = ctx.$match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const isTomorrow =
      !!ctx.$match?.groups?.tomorrow ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;

    if (!groupName) {
      if (session.selectedGroupName) {
        ctx.send(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: groupNameFromMath,
          }),
        );
        return;
      }
      ctx.scene.enter(SELECT_GROUP_SCENE);
      return;
    }

    ctx.setActivity();

    let message: string | false;
    let days: number;
    if (isTomorrow) {
      skipDays = 1;
      [days, message] = await this.ystutyService.findNext({
        skipDays,
        groupName,
      });
    } else if (_skipDays !== null) {
      message = await this.ystutyService.getFormatedSchedule({
        skipDays,
        groupName,
      });
    } else {
      [days, message] = await this.ystutyService.findNext({
        groupName,
      });
    }

    if (message && days - 1 > skipDays) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
        days,
        content: message,
      });
    }

    if (!message) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
    }

    const keyboard = this.keyboardFactory
      .getSchedule(ctx, groupName)
      .inline(true);
    ctx.send(`${message}\n[${groupName}]`, { keyboard });
  }

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_For_Week,
    LocalePhrase.Button_Schedule_ForWeek,
    LocalePhrase.Button_Schedule_ForNextWeek,
  ])
  async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
    const session = !ctx.isChat ? ctx.session : ctx.sessionConversation;

    const groupNameFromMath = ctx.$match?.groups?.groupName;
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromMath ||
        ctx.messagePayload?.groupName ||
        session.selectedGroupName,
    );

    const isNextWeek =
      !!ctx.$match?.groups?.next ||
      ctx.messagePayload?.phrase === LocalePhrase.Button_Schedule_ForNextWeek;
    let skipDays = isNextWeek ? 7 + 1 : 1;

    if (!groupName) {
      if (session.selectedGroupName) {
        ctx.send(
          ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
            groupName: groupNameFromMath,
          }),
        );
        return;
      }
      ctx.scene.enter(SELECT_GROUP_SCENE);
      return;
    }

    ctx.setActivity();

    let [days, message] = await this.ystutyService.findNext({
      skipDays,
      groupName,
      isWeek: true,
    });

    if (message) {
      if (days - 1 > skipDays) {
        message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
          days,
          content: message,
        });
      }

      message = `Расписание на ${
        isNextWeek ? 'следющую ' : ''
      }неделю:\n${message}`;
    } else {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
    }

    const keyboard = this.keyboardFactory
      .getSchedule(ctx, groupName)
      .inline(true);
    ctx.send(`${message}\n[${groupName}]`, { keyboard });
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
