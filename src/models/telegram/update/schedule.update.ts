import { UseFilters } from '@nestjs/common';
import {
  Action,
  Command,
  Ctx,
  Hears,
  On,
  Update,
} from '@xtcry/nestjs-telegraf';

import * as tg from 'telegraf/typings/core/types/typegram';
import type { Update as TgUpdate } from 'telegraf/types';

import {
  allowerHtmlTags,
  isPersonalTeacherScheduleCommand,
  isPersonalTeacherWeekCommand,
  patternGroupName,
  patternTeacherId,
  personalTeacherScheduleCommandRegExp,
  personalTeacherWeekCommandRegExp,
  TelegrafExceptionFilter,
} from '@my-common';
import { TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase, TelegramLocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/telegram';

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

    const groupNameQuery =
      ctx.inlineQuery.query.trim() || ctx.userSocial?.groupName;
    const groupName =
      groupNameQuery &&
      (this.ystutyService.getGroupByName(groupNameQuery) ||
        this.ystutyService.parseGroupName(groupNameQuery));
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

    const messageTomorrow =
      (
        await this.ystutyService.findNext({
          skipDays: 1,
          groupName,
          withTags: true,
        })
      )[1] || `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;

    const messageWeek =
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
  @Hears(personalTeacherScheduleCommandRegExp)
  @TgHearsLocale([
    LocalePhrase.RegExp_Schedule_For_OneDay,
    LocalePhrase.Button_Schedule_Schedule,
    LocalePhrase.Button_Schedule_ForToday,
    LocalePhrase.Button_Schedule_ForTomorrow,
    LocalePhrase.Button_Schedule_MyTeacher,
  ])
  @Action(
    [
      LocalePhrase.Button_Schedule_Schedule,
      LocalePhrase.Button_Schedule_ForToday,
      LocalePhrase.Button_Schedule_ForTomorrow,
    ].map(
      (e) =>
        new RegExp(
          `^(?<phrase>${e.replaceAll('.', '\\.')})(?::${patternGroupName})?$`,
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
          `^(?<phrase>${e.replaceAll('.', '\\.')}):teacher:${patternTeacherId}$`,
          'i',
        ),
    ),
  )
  async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const isPersonalTeacherCommand =
      ctx.command === 'tday' ||
      (ctx.message &&
        'text' in ctx.message &&
        isPersonalTeacherScheduleCommand(ctx.message.text)) ||
      (ctx.message &&
        'text' in ctx.message &&
        ctx.message.text ===
          ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher));
    const selectedTeacherId = teacherIdFromMath
      ? Number(teacherIdFromMath)
      : isPersonalTeacherCommand
        ? this.getPersonalTeacherId(ctx)
        : undefined;

    let targetId: string | number;
    let targetType: 'group' | 'teacher';

    if (selectedTeacherId) {
      targetId = selectedTeacherId;
      targetType = 'teacher';
    } else {
      if (isPersonalTeacherCommand) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotSelected),
        );
        return;
      }

      const selectedGroupName =
        ctx.chat.type === 'private'
          ? ctx.userSocial.groupName
          : ctx.sessionConversation.selectedGroupName;

      const groupNameFromMath = ctx.match?.groups?.groupName;
      const groupNameQuery = groupNameFromMath || selectedGroupName;
      const groupName =
        groupNameQuery &&
        (this.ystutyService.getGroupByName(groupNameQuery) ||
          this.ystutyService.parseGroupName(groupNameQuery));

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

    let message: string | false | null;
    let days: number = 0;
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

    const targetName = allowerHtmlTags(
      targetType === 'group'
        ? String(targetId)
        : this.ystutyService.getTeacherName(+targetId) || '',
      '',
    );

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      targetType === 'teacher'
        ? { type: 'teacher', id: Number(targetId) }
        : { type: 'group', id: String(targetId) },
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
  @Hears(personalTeacherWeekCommandRegExp)
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
          `^(?<phrase>${e.replaceAll('.', '\\.')})(?::${patternGroupName})?$`,
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
          `^(?<phrase>${e.replaceAll('.', '\\.')}):teacher:${patternTeacherId}$`,
          'i',
        ),
    ),
  )
  async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
    const teacherIdFromMath = ctx.match?.groups?.teacherId;
    const isPersonalTeacherCommand =
      ctx.command === 'tweek' ||
      (ctx.message &&
        'text' in ctx.message &&
        isPersonalTeacherWeekCommand(ctx.message.text)) ||
      (ctx.message &&
        'text' in ctx.message &&
        ctx.message.text ===
          ctx.i18n.t(LocalePhrase.Button_Schedule_MyTeacher));
    const selectedTeacherId = teacherIdFromMath
      ? Number(teacherIdFromMath)
      : isPersonalTeacherCommand
        ? this.getPersonalTeacherId(ctx)
        : undefined;

    let targetId: string | number;
    let targetType: 'group' | 'teacher';

    if (selectedTeacherId) {
      targetId = selectedTeacherId;
      targetType = 'teacher';
    } else {
      if (isPersonalTeacherCommand) {
        await ctx.replyWithHTML(
          ctx.i18n.t(LocalePhrase.Page_Schedule_TeacherNotSelected),
        );
        return;
      }

      const selectedGroupName =
        ctx.chat.type === 'private'
          ? ctx.userSocial.groupName
          : ctx.sessionConversation.selectedGroupName;

      const groupNameFromMath = ctx.match?.groups?.groupName;
      const groupNameQuery = groupNameFromMath || selectedGroupName;
      const groupName =
        groupNameQuery &&
        (this.ystutyService.getGroupByName(groupNameQuery) ||
          this.ystutyService.parseGroupName(groupNameQuery));

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
    const skipDays = isNextWeek ? 7 + 1 : 1;

    if (!ctx.callbackQuery) {
      await ctx.sendChatAction('typing');
    }

    const [days, scheduleMessage] = await this.ystutyService.findNext({
      targetId,
      targetType,
      skipDays,
      isWeek: true,
      withTags: true,
    });
    let message = scheduleMessage;

    if (message) {
      if (days - 1 > skipDays) {
        message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
          days,
          content: message,
        });
      }

      message = `${ctx.i18n.t(
        targetType === 'teacher'
          ? LocalePhrase.Page_Schedule_TeacherWeekTitle
          : LocalePhrase.Page_Schedule_WeekTitle,
        { isNextWeek },
      )}\n${message}`;
    } else {
      message = `${ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday)}\n`;
    }

    const targetName = allowerHtmlTags(
      targetType === 'group'
        ? String(targetId)
        : this.ystutyService.getTeacherName(+targetId) || '',
      '',
    );

    const keyboard = this.keyboardFactory.getScheduleInline(
      ctx,
      targetType === 'teacher'
        ? { type: 'teacher', id: Number(targetId) }
        : { type: 'group', id: String(targetId) },
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
      // Use stream message for example
      if (Math.random() > 0.5) {
        await ctx.sendStreamingMessage(content, {
          parse_mode: 'HTML',
          // chunkDelay: 80,
        });
        return;
      }
      await ctx.replyWithHTML(content, keyboard);
    }
  }

  /** Возвращает выбранного преподавателя или однозначное совпадение ФИО профиля. */
  private getPersonalTeacherId(ctx: IMessageContext) {
    return (
      ctx.session.teacherId ??
      this.ystutyService.getTeacherByExactName(ctx.user?.fullname)?.id
    );
  }
}
