import { Action, Ctx, Hears, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/types';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext, IStepContext } from '@my-interfaces/telegram';

import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

export const TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotificationGroupSceneState = {
  notificationId: number;
};

/** Самостоятельный выбор группы рассылки, не затрагивающий группу профиля. */
@Wizard(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE)
export class TelegramScheduleNotificationGroupScene extends BaseScene {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  /** Открывает список институтов сразу после входа в сцену. */
  public async open(ctx: ICallbackQueryContext) {
    await this.renderInstitutes(
      ctx as IStepContext<ScheduleNotificationGroupSceneState>,
      1,
    );
  }

  @WizardStep(1)
  @Hears(/.+/)
  @Action(/scheduleNotificationGroup:.+/)
  @Action(/pager:schedule-notification-institutes:(?<page>[0-9]+)/)
  @Action(
    /pager:schedule-notification-groups:(?<instituteNameMD5>[a-f0-9]{32}):(?<page>[0-9]+)/,
  )
  async step(@Ctx() ctx: IStepContext<ScheduleNotificationGroupSceneState>) {
    const notificationId = ctx.scene.state.notificationId;
    const callbackData =
      ctx.callbackQuery && 'data' in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : undefined;

    if (!callbackData) {
      const groupName =
        ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      if (groupName) {
        await this.selectGroup(ctx, notificationId, groupName);
      }
      return;
    }

    if (callbackData.startsWith('pager:schedule-notification-institutes:')) {
      await this.renderInstitutes(ctx, Number(callbackData.split(':')[2]) || 1);
      return;
    }
    if (callbackData.startsWith('pager:schedule-notification-groups:')) {
      const [, , instituteNameMD5, page] = callbackData.split(':');
      await this.renderGroups(
        ctx,
        notificationId,
        instituteNameMD5,
        Number(page) || 1,
      );
      return;
    }

    const [, action, firstParam, secondParam] = callbackData.split(':');
    if (action === 'institutes') {
      await this.renderInstitutes(ctx, Number(firstParam) || 1);
      return;
    }
    if (action === 'groups') {
      await this.renderGroups(
        ctx,
        notificationId,
        firstParam,
        Number(secondParam) || 1,
      );
      return;
    }
    if (action === 'select') {
      await this.selectGroup(ctx, notificationId, firstParam);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    page: number,
  ) {
    const { items, currentPage, totalPages } =
      this.ystutyService.groupsInstitutesList(page, 26);
    const keyboard = this.keyboardFactory.getPagination({
      name: 'schedule-notification-institutes',
      currentPage,
      totalPages,
      items: items.map((title) => ({
        title,
        payload: `groups:${md5(title)}:1`,
      })),
      actionPrefix: 'scheduleNotificationGroup:',
      columnizer: true,
    });
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_InstitutesList, {
        currentPage,
        totalPages,
      }),
      keyboard,
    );
  }

  private async renderGroups(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    instituteNameMD5: string,
    page: number,
  ) {
    const { items, currentPage, totalPages } = this.ystutyService.groupsList(
      page,
      26,
      instituteNameMD5,
    );
    const instituteName =
      this.ystutyService.instituteNameByMD5(instituteNameMD5);
    const keyboard = this.keyboardFactory.getPagination({
      name: `schedule-notification-groups:${instituteNameMD5}`,
      currentPage,
      totalPages,
      items: items.map((title) => ({ title, payload: `select:${title}` })),
      actionPrefix: 'scheduleNotificationGroup:',
      additionalButtons: [
        Markup.button.callback(
          ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
          'scheduleNotificationGroup:institutes:1',
        ),
      ],
      columnizer: true,
    });
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
        instituteName,
        currentPage,
        totalPages,
      }),
      keyboard,
    );
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    groupName: string,
  ) {
    if (!this.ystutyService.getGroupByName(groupName)) {
      await this.renderNotFound(ctx, groupName);
      return;
    }
    const changed = await this.notificationService.changeGroup(
      ctx.userSocial.id,
      notificationId,
      groupName,
    );
    if (!changed) {
      await this.renderNotFound(ctx, groupName);
      return;
    }

    await ctx.scene.leave();
    await ctx.tryAnswerCbQuery('Группа изменена');
    const notification = await this.notificationService.getFirstNotification(
      ctx.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      return;
    }
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
        notification: {
          ...notification,
          weekdaysLabel: this.getWeekdaysLabel(notification.weekdays),
        },
      }),
      this.keyboardFactory.getScheduleNotificationEditor(ctx, notification),
    );
  }

  private async renderNotFound(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    groupName: string,
  ) {
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
            'scheduleNotificationGroup:institutes:1',
          ),
        ],
      ]),
    );
  }

  private async editOrReply(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    text: string,
    keyboard: Markup.Markup<InlineKeyboardMarkup>,
  ) {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
      await ctx.tryAnswerCbQuery();
      return;
    }
    await ctx.replyWithHTML(text, keyboard);
  }

  private getWeekdaysLabel(weekdays: number[]) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return weekdays
      .map((weekday) => labels[weekday - 1])
      .filter(Boolean)
      .join(', ');
  }
}
