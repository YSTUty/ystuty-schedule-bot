import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { type KeyboardBuilder } from 'vk-io';

import { md5, VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageEventContext, IStepContext } from '@my-interfaces/vk';

import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

export const VK_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'VK_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotificationGroupSceneState = {
  notificationId: number;
};

/** Самостоятельный выбор группы для рассылки, не изменяющий группу профиля. */
@Scene(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class VkScheduleNotificationGroupScene {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  /** Открывает список институтов сразу после входа в сцену. */
  public async open(ctx: IMessageEventContext) {
    await this.renderInstitutes(
      ctx as IStepContext<ScheduleNotificationGroupSceneState>,
      1,
    );
  }

  @AddStep()
  async step(@Ctx() ctx: IStepContext<ScheduleNotificationGroupSceneState>) {
    const notificationId = ctx.scene.state.notificationId;
    const action =
      'eventPayload' in ctx
        ? (ctx.eventPayload.scheduleNotificationGroupAction as
            | string
            | undefined)
        : undefined;

    if (action === 'institutes' || ctx.scene.step.firstTime) {
      await this.renderInstitutes(ctx, 1);
      return;
    }
    if (action === 'institutesPage') {
      await this.renderInstitutes(ctx, Number(ctx.eventPayload.page) || 1);
      return;
    }
    if (action === 'groups' || action === 'groupsPage') {
      await this.renderGroups(
        ctx,
        notificationId,
        String(ctx.eventPayload.instituteNameMD5),
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }
    if (action === 'select') {
      await this.selectGroup(
        ctx,
        notificationId,
        String(ctx.eventPayload.groupName),
      );
      return;
    }

    if (!ctx.scene.step.firstTime && ctx.text) {
      await this.selectGroup(ctx, notificationId, ctx.text);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    page: number,
  ) {
    const notificationId = ctx.scene.state.notificationId;
    const { items, currentPage, totalPages } =
      this.ystutyService.groupsInstitutesList(page, 5);
    const keyboard = this.keyboardFactory.getPagination({
      currentPage,
      totalPages,
      items: items.map((title) => ({
        title,
        payload: {
          scheduleNotificationGroupAction: 'groups',
          notificationId,
          instituteNameMD5: md5(title),
        },
      })),
      getPagePayload: (nextPage) => ({
        scheduleNotificationGroupAction: 'institutesPage',
        notificationId,
        page: nextPage,
      }),
    });
    await this.sendOrEdit(
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
      4,
      instituteNameMD5,
    );
    const instituteName =
      this.ystutyService.instituteNameByMD5(instituteNameMD5);
    const keyboard = this.keyboardFactory.getPagination({
      currentPage,
      totalPages,
      items: this.toGroupRows(items, notificationId),
      getPagePayload: (nextPage) => ({
        scheduleNotificationGroupAction: 'groupsPage',
        notificationId,
        instituteNameMD5,
        page: nextPage,
      }),
      additionalButtons: [
        [
          this.keyboardFactory.getInstitutesListButton(ctx, {
            scheduleNotificationGroupAction: 'institutes',
            notificationId,
          }),
        ],
      ],
    });
    await this.sendOrEdit(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
        instituteName,
        currentPage,
        totalPages,
      }),
      keyboard,
    );
  }

  private toGroupRows(groupNames: string[], notificationId: number) {
    return Array.from(
      { length: Math.ceil(groupNames.length / 2) },
      (_, index) =>
        groupNames.slice(index * 2, (index + 1) * 2).map((title) => ({
          title,
          payload: {
            scheduleNotificationGroupAction: 'select',
            notificationId,
            groupName: title,
          },
        })),
    );
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    groupName: string,
  ) {
    if (!this.ystutyService.getGroupByName(groupName)) {
      await this.renderNotFound(ctx, notificationId, groupName);
      return;
    }
    const changed = await this.notificationService.changeGroup(
      ctx.state.userSocial.id,
      notificationId,
      groupName,
    );
    if (!changed) {
      await this.renderNotFound(ctx, notificationId, groupName);
      return;
    }

    await ctx.scene.leave();
    if ('answer' in ctx) {
      await ctx.answer({ type: 'show_snackbar', text: 'Группа изменена' });
    }
    const notification = await this.notificationService.getFirstNotification(
      ctx.state.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      return;
    }
    await this.sendOrEdit(
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
    notificationId: number,
    groupName: string,
  ) {
    const keyboard = this.keyboardFactory.getPagination({
      currentPage: 1,
      totalPages: 1,
      items: [
        {
          title: ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
          payload: {
            scheduleNotificationGroupAction: 'institutes',
            notificationId,
          },
        },
      ],
      getPagePayload: () => ({}),
    });
    await this.sendOrEdit(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      keyboard,
    );
  }

  private getWeekdaysLabel(weekdays: number[]) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return weekdays
      .map((weekday) => labels[weekday - 1])
      .filter(Boolean)
      .join(', ');
  }

  private async sendOrEdit(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    message: string,
    keyboard: KeyboardBuilder,
  ) {
    const inlineKeyboard = keyboard.inline();
    if ('eventPayload' in ctx) {
      await ctx.api.messages.edit({
        peer_id: ctx.peerId,
        cmid: ctx.conversationMessageId,
        message,
        keyboard: inlineKeyboard,
      });
      return;
    }
    await ctx.send(message, { keyboard: inlineKeyboard });
  }
}
