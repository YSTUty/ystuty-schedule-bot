import { UseFilters } from '@nestjs/common';
import { Update, Ctx } from 'nestjs-vk';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';
import { VkHearsLocale } from '@my-common/decorator/vk';

import { YSTUtyService } from '../../ystuty/ystuty.service';

import { VKKeyboardFactory } from '../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../vk.constants';

@Update()
@UseFilters(VkExceptionFilter)
export class ScheduleUpdate {
  constructor(
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

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
}
