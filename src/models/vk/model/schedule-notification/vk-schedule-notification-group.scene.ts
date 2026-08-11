import { Logger, UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { type KeyboardBuilder } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageEventContext, IStepContext } from '@my-interfaces/vk';

import { getWeekdaysLabel } from '../../../schedule-notification/schedule-notification-ui.util';
import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkGroupPicker } from '../vk-group-picker';

export const VK_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'VK_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotificationGroupSceneState = {
  notificationId: number;
};

/** Самостоятельный выбор группы для рассылки, не изменяющий группу профиля. */
@Scene(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class VkScheduleNotificationGroupScene {
  private readonly logger = new Logger(VkScheduleNotificationGroupScene.name);

  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly groupPicker: VkGroupPicker,
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step(@Ctx() ctx: IStepContext<ScheduleNotificationGroupSceneState>) {
    const notificationId = ctx.scene.state.notificationId;
    const action =
      'eventPayload' in ctx
        ? (ctx.eventPayload.scheduleNotifGroupAction as string | undefined)
        : undefined;

    this.logger.debug(
      `action=${action || '-'} page=${ctx.eventPayload?.page || '-'} notificationId=${notificationId} instituteHash=${ctx.eventPayload?.instituteHash || '-'} firstTime=${ctx.scene.step.firstTime}`,
    );

    if (ctx.scene.step.firstTime) {
      await this.renderInstitutes(ctx, 1);
      return;
    }

    if (action === 'institutes' || action === 'back') {
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
        String(ctx.eventPayload.instituteHash),
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
    if (action === 'cancel') {
      await this.returnToEditor(ctx, notificationId);
      return;
    }

    if (ctx.text) {
      await this.selectGroup(ctx, notificationId, ctx.text);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    page: number,
  ) {
    const notificationId = ctx.scene.state.notificationId;
    const { text, keyboard } = this.groupPicker.renderInstitutes(ctx, page, {
      onItem: (instituteHash) => ({
        scheduleNotifGroupAction: 'groups',
        notificationId,
        instituteHash,
      }),
      onPage: (_instituteHash, nextPage) => ({
        scheduleNotifGroupAction: 'institutesPage',
        notificationId,
        page: nextPage,
      }),
      additionalButtons: [
        [
          this.keyboardFactory.getScheduleNotificationGroupPickerCancelButton(
            ctx,
            notificationId,
          ),
        ],
      ],
    });
    await this.sendOrEdit(ctx, text, keyboard);
  }

  private async renderGroups(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    instituteHash: string,
    page: number,
  ) {
    const { text, keyboard } = this.groupPicker.renderGroups(
      ctx,
      instituteHash,
      page,
      {
        onItem: (groupName) => ({
          scheduleNotifGroupAction: 'select',
          notificationId,
          groupName,
        }),
        onPage: (hash, nextPage) => ({
          scheduleNotifGroupAction: 'groupsPage',
          notificationId,
          instituteHash: hash,
          page: nextPage,
        }),
        additionalButtons: [
          [
            this.keyboardFactory.getInstitutesListButton(ctx, {
              scheduleNotifGroupAction: 'back',
              notificationId,
            }),
          ],
          [
            this.keyboardFactory.getScheduleNotificationGroupPickerCancelButton(
              ctx,
              notificationId,
            ),
          ],
        ],
      },
    );
    await this.sendOrEdit(ctx, text, keyboard);
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
    if (ctx.isMessageEventContext()) {
      await ctx.answer({ type: 'show_snackbar', text: 'Группа изменена' });
    }
    await this.renderEditor(ctx, notificationId);
  }

  /** Возвращает к редактору только из inline-выбора группы рассылки. */
  private async returnToEditor(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
  ) {
    await ctx.scene.leave();
    await this.renderEditor(ctx, notificationId);
  }

  private async renderEditor(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
  ) {
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
          weekdaysLabel: getWeekdaysLabel(notification.weekdays),
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
      items: [],
      getPagePayload: () => ({}),
      additionalButtons: [
        [
          this.keyboardFactory.getInstitutesListButton(ctx, {
            scheduleNotifGroupAction: 'institutes',
            notificationId,
          }),
        ],
        [
          this.keyboardFactory.getScheduleNotificationGroupPickerCancelButton(
            ctx,
            notificationId,
          ),
        ],
      ],
      pagerMode: 'compact',
    });
    await this.sendOrEdit(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      keyboard,
    );
  }

  private async sendOrEdit(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    message: string,
    keyboard: KeyboardBuilder,
  ) {
    const inlineKeyboard = keyboard.inline();
    if (ctx.isMessageEventContext()) {
      await ctx.editMessage({ message, keyboard: inlineKeyboard });
      return;
    }
    await ctx.send(message, { keyboard: inlineKeyboard });
  }
}
