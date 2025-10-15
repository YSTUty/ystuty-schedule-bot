import { UseFilters } from '@nestjs/common';
import { Action, Command, Ctx, Update, On } from '@xtcry/nestjs-telegraf';
import * as tg from 'telegraf/typings/core/types/typegram';
import type { Update as TgUpdate } from 'telegraf/types';

import {
  allowerHtmlTags,
  patternGroupName,
  patternTeacherId,
  TelegrafExceptionFilter,
} from '@my-common';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/telegram';
import { TgHearsLocale } from '@my-common/decorator/tg';

import { YSTUtyService } from '../../ystuty/ystuty.service';

import { TelegramKeyboardFactory } from '../telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../telegram.constants';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class ScheduleUpdate {
  constructor(
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly ystutyService: YSTUtyService,
  ) {}

  @On('inline_query')
  async onInlineQuery(@Ctx() ctx: IContext<{}, TgUpdate.InlineQueryUpdate>) {
    // TODO: add to queue and wait

    console.log('ctx.inlineQuery', ctx.inlineQuery);

    const groupNameFromQuery = ctx.inlineQuery.query.trim();
    const groupName = this.ystutyService.getGroupByName(
      groupNameFromQuery || ctx.userSocial?.groupName,
    );

    if (!groupName) {
      if (ctx.userSocial?.groupName) {
        await ctx.answerInlineQuery(
          [
            {
              id: 'schedule:404',
              type: 'sticker',
              sticker_file_id:
                // ? how long will it last
                'CAACAgIAAxkBAAEEJypiLmxc-eE-xdTeukvAF29X_VcjXAAC-gADVp29Ckfe-pdxdHEBIwQ',
            },
          ],
          { cache_time: 30, is_personal: true },
        );
        return;
      }

      const start_parameter = LocalePhrase.Button_SelectGroup.replace(
        /\./g,
        '--',
      );
      await ctx.answerInlineQuery([], {
        // is_personal: true,
        cache_time: 10,
        button: {
          text: ctx.i18n.t(TelegramLocalePhrase.Page_SelectYourGroup),
          start_parameter,
        },
      });
      return;
    }

    let messageDay = await this.ystutyService.getFormatedSchedule({
      targetId: groupName,
      targetType: 'group',
      withTags: true,
    });
    if (!messageDay) {
      if (messageDay === false) {
        messageDay = `${ctx.i18n.t(LocalePhrase.Common_Error)}\n`;
      } else {
        messageDay = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;
      }
    }

    let messageTomorrow =
      (
        await this.ystutyService.findNext({
          skipDays: 1,
          groupName,
          withTags: true,
        })
      )[1] || `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;

    let messageWeek =
      (
        await this.ystutyService.findNext({
          skipDays: 1,
          groupName,
          isWeek: true,
          withTags: true,
        })
      )[1] || `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text:
              ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Share) + ' где-то',
            switch_inline_query: groupName,
          },
        ],
        [
          {
            text: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Share) + ' тут',
            switch_inline_query_current_chat: groupName,
          },
        ],
      ],
    };

    const results: tg.InlineQueryResult[] = [];
    const cropStr = (str: string) =>
      str.length > 120 ? `${str.slice(0, 120)}...` : str;

    results.push({
      type: 'article',
      id: `schedule:${groupName}:day`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForToday, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageDay, '')),
      input_message_content: {
        message_text: `${messageDay}[${groupName}]`,
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    results.push({
      type: 'article',
      id: `schedule:${groupName}:tomorrow`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForTomorrow, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageTomorrow, '')),
      input_message_content: {
        message_text: `${messageTomorrow}[${groupName}]`,
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    results.push({
      type: 'article',
      id: `schedule:${groupName}:week`,
      title: ctx.i18n.t(TelegramLocalePhrase.Page_Schedule_Title_ForWeek, {
        groupName,
      }),
      description: cropStr(allowerHtmlTags(messageWeek, '')),
      input_message_content: {
        message_text: `${messageWeek}[${groupName}]`,
        parse_mode: 'HTML',
      },
      reply_markup,
    });

    await ctx.answerInlineQuery(results, {
      is_personal: true,
      cache_time: 60,
    });
  }

  @Command('tt')
  @Command('day')
  @Command('tday')
  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
  ])
  @Action(
    [
      LocalePhrase.Button_Schedule_Schedule,
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].map(
      (e) =>
        new RegExp(
          `(?<phrase>${e.replace('.', '\\.')}):?${patternGroupName}?`,
          'i',
        ),
    ),
  )
  @Action(
    [
      LocalePhrase.Button_Schedule_Schedule,
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].map(
      (e) =>
        new RegExp(
          `(?<phrase>${e.replace('.', '\\.')}):?${patternTeacherId}?`,
          'i',
        ),
    ),
  )
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const selectedTeacherId =
      teacherIdFromMath ||
      (ctx.message && 'text' in ctx.message && ctx.message.text === '/tday')
        ? ctx.session.teacherId
        : null;

    let targetId: string | number = Number(selectedTeacherId);
    let targetType: 'group' | 'teacher' = 'teacher';

    if (!selectedTeacherId) {
      const selectedGroupName =
        ctx.chat.type === 'private'
          ? ctx.userSocial.groupName
          : ctx.sessionConversation.selectedGroupName;

      const groupNameFromMath = ctx.match?.groups?.groupName;
      const groupName = this.ystutyService.getGroupByName(
        groupNameFromMath || selectedGroupName,
      );

      if (!groupName) {
        if (selectedGroupName) {
          await ctx.replyWithHTML(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
              groupName: groupNameFromMath,
            }),
          );
          return;
        }
        await ctx.scene.enter(SELECT_GROUP_SCENE);
        return;
      }

      targetId = groupName;
      targetType = 'group';
    }

    const _skipDays = ctx.match?.groups?.skipDays ?? null;
    let skipDays = Number(_skipDays) || 0;
    const isTomorrow =
      !!ctx.match?.groups?.tomorrow ||
      ctx.match?.groups?.phrase === LocalePhrase.Button_Schedule_ForTomorrow;

    if (!ctx.callbackQuery) {
      await ctx.sendChatAction('typing');
    }

    let message: string | false;
    let days: number;
    if (isTomorrow) {
      skipDays = 1;
      [days, message] = await this.ystutyService.findNext({
        skipDays,
        targetId,
        targetType,
        withTags: true,
      });
    } else if (_skipDays !== null) {
      message = await this.ystutyService.getFormatedSchedule({
        skipDays,
        targetId,
        targetType,
        withTags: true,
      });
      if (message === false) {
        message = `${ctx.i18n.t(LocalePhrase.Common_Error)}\n`;
      }
    } else {
      [days, message] = await this.ystutyService.findNext({
        targetId,
        targetType,
        withTags: true,
      });
    }

    if (message && days - 1 > skipDays) {
      message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
        days,
        content: message,
      });
    }

    if (!message) {
      message = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;
    }

    const targetName =
      targetType === 'group'
        ? targetId
        : this.ystutyService.getTeacherName(+targetId);

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      String(targetId),
    );
    const content = `${message}[${targetName}]`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  @Command('week')
  @Command('tweek')
  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_For_Week,
    LocalePhrase.Button_Schedule_ForWeek,
    LocalePhrase.Button_Schedule_ForNextWeek,
  ])
  @Action(
    [
      LocalePhrase.Button_Schedule_ForWeek,
      LocalePhrase.Button_Schedule_ForNextWeek,
    ].map(
      (e) =>
        new RegExp(
          `(?<phrase>${e.replace('.', '\\.')}):?${patternGroupName}?`,
          'i',
        ),
    ),
  )
  @Action(
    [
      LocalePhrase.Button_Schedule_ForWeek,
      LocalePhrase.Button_Schedule_ForNextWeek,
    ].map(
      (e) =>
        new RegExp(
          `(?<phrase>${e.replace('.', '\\.')}):?${patternTeacherId}?`,
          'i',
        ),
    ),
  )
  async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const selectedTeacherId =
      teacherIdFromMath ||
      (ctx.message && 'text' in ctx.message && ctx.message.text === '/tweek')
        ? ctx.session.teacherId
        : null;

    let targetId: string | number = Number(selectedTeacherId);
    let targetType: 'group' | 'teacher' = 'teacher';

    if (!selectedTeacherId) {
      const selectedGroupName =
        ctx.chat.type === 'private'
          ? ctx.userSocial.groupName
          : ctx.sessionConversation.selectedGroupName;

      const groupNameFromMath = ctx.match?.groups?.groupName;
      const groupName = this.ystutyService.getGroupByName(
        groupNameFromMath || selectedGroupName,
      );

      if (!groupName) {
        if (selectedGroupName) {
          await ctx.replyWithHTML(
            ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
              groupName: groupNameFromMath,
            }),
          );
          return;
        }
        await ctx.scene.enter(SELECT_GROUP_SCENE);
        return;
      }

      targetId = groupName;
      targetType = 'group';
    }

    const isNextWeek =
      !!ctx.match?.groups?.next ||
      ctx.match?.groups?.phrase === LocalePhrase.Button_Schedule_ForNextWeek;
    let skipDays = isNextWeek ? 7 + 1 : 1;

    if (!ctx.callbackQuery) {
      await ctx.sendChatAction('typing');
    }

    let [days, message] = await this.ystutyService.findNext({
      targetId,
      targetType,
      skipDays,
      isWeek: true,
      withTags: true,
    });

    if (message) {
      if (days - 1 > skipDays) {
        message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
          days,
          content: message,
        });
      }

      message = `Расписание на ${
        isNextWeek ? 'следующую ' : ''
      }неделю:\n${message}`;
    } else {
      message = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;
    }

    const targetName =
      targetType === 'group'
        ? targetId
        : this.ystutyService.getTeacherName(+targetId);

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      String(targetId),
    );
    const content = `${message}[${targetName}]`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(content, {
          ...keyboard,
          parse_mode: 'HTML',
        });
      } catch {}
      await ctx.answerCbQuery();
    } else {
      await ctx.replyWithHTML(content, keyboard);
    }
  }
}
