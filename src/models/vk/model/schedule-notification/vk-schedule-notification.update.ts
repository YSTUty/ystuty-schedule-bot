import { UseFilters } from '@nestjs/common';
import { Ctx, Next, On, Update } from 'nestjs-vk';

import { NextMiddleware } from 'middleware-io';

import { VkHearsLocale } from '@my-common/decorator/vk';
import { VkExceptionFilter } from '@my-common/filter/vk-exception.filter';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { ScheduleNotificationTargetDayOffset } from '../../../schedule-notification/schedule-notification.types';
import {
  getWeekdaysLabel,
  parseWeekdays,
  toggleWeekday,
} from '../../../schedule-notification/schedule-notification-ui.util';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

import {
  VK_SCHEDULE_NOTIFICATION_GROUP_SCENE,
  VkScheduleNotificationGroupScene,
} from './vk-schedule-notification-group.scene';

@Update()
@UseFilters(VkExceptionFilter)
export class VkScheduleNotificationUpdate {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @VkHearsLocale(LocalePhrase.Button_ScheduleNotification)
  async openFromMenu(@Ctx() ctx: IMessageContext) {
    await this.openSettings(ctx);
  }

  @On('message_event')
  async onMessageEvent(
    @Ctx() ctx: IMessageEventContext,
    @Next() next: NextMiddleware,
  ) {
    const action = (ctx.eventPayload.scheduleNotifAction ||
      (ctx.eventPayload.phrase === LocalePhrase.Button_ScheduleNotification &&
        'settings')) as string | undefined;
    if (!action) {
      return next();
    }
    if (!ctx.isDM) {
      return;
    }

    if (action === 'create') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory.getScheduleNotificationHours(ctx).inline(),
      );
    } else if (action === 'settings') {
      // Основная VK-клавиатура не всегда передаёт cmid исходного сообщения.
      // Поэтому вход в настройки создаёт отдельное inline-сообщение для шагов wizard.
      await this.openSettings(ctx);
    } else if (action === 'edit') {
      await this.openEditor(ctx, Number(ctx.eventPayload.notificationId));
    } else if (action === 'hours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory
          .getScheduleNotificationHours(ctx, Number(ctx.eventPayload.page))
          .inline(),
      );
    } else if (action === 'editHours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory
          .getScheduleNotificationHours(
            ctx,
            Number(ctx.eventPayload.page),
            Number(ctx.eventPayload.notificationId),
          )
          .inline(),
      );
    } else if (action === 'changeGroup') {
      await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
        state: { notificationId: Number(ctx.eventPayload.notificationId) },
      });
    } else if (action === 'editTime') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory
          .getScheduleNotificationHours(
            ctx,
            1,
            Number(ctx.eventPayload.notificationId),
          )
          .inline(),
      );
    } else if (action === 'editHour') {
      const notificationId = Number(ctx.eventPayload.notificationId);
      const hour = Number(ctx.eventPayload.hour);
      if (Number.isInteger(hour)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
          this.keyboardFactory
            .getScheduleNotificationMinutes(ctx, hour, notificationId)
            .inline(),
        );
      } else {
        await this.openEditor(ctx, notificationId);
      }
    } else if (action === 'editMinute') {
      await this.updateEditorSettings(
        ctx,
        Number(ctx.eventPayload.notificationId),
        {
          deliveryHour: Number(ctx.eventPayload.hour),
          deliveryMinute: Number(ctx.eventPayload.minute),
        },
      );
    } else if (action === 'editDay') {
      await this.updateEditorSettings(
        ctx,
        Number(ctx.eventPayload.notificationId),
        {
          targetDayOffset: Number(
            ctx.eventPayload.targetDayOffset,
          ) as ScheduleNotificationTargetDayOffset,
        },
      );
    } else if (action === 'editWeekdays') {
      const notification = await this.notificationService.getFirstNotification(
        ctx.state.userSocial.id,
      );
      if (
        notification &&
        notification.id === Number(ctx.eventPayload.notificationId)
      ) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
            notification: {
              ...notification,
              weekdaysLabel: getWeekdaysLabel(notification.weekdays),
            },
          }),
          this.keyboardFactory
            .getScheduleNotificationEditorWeekdays(ctx, notification)
            .inline(),
        );
      } else {
        await this.openSettings(ctx, true);
      }
    } else if (action === 'editWeekday') {
      const notification = await this.notificationService.getFirstNotification(
        ctx.state.userSocial.id,
      );
      if (
        notification &&
        notification.id === Number(ctx.eventPayload.notificationId)
      ) {
        await this.updateEditorSettings(ctx, notification.id, {
          weekdays: toggleWeekday(
            notification.weekdays,
            Number(ctx.eventPayload.weekday),
          ),
        });
      } else {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Рассылка не найдена',
        });
        await this.openSettings(ctx, true);
      }
    } else if (action === 'editSave') {
      await this.openSettings(ctx, true);
    } else if (action === 'hour') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
        this.keyboardFactory
          .getScheduleNotificationMinutes(ctx, Number(ctx.eventPayload.hour))
          .inline(),
      );
    } else if (action === 'minute') {
      const hour = Number(ctx.eventPayload.hour);
      const minute = Number(ctx.eventPayload.minute);
      if (!Number.isInteger(minute)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
          this.keyboardFactory
            .getScheduleNotificationMinutes(ctx, hour)
            .inline(),
        );
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectTargetDay),
        this.keyboardFactory
          .getScheduleNotificationTargetDay(ctx, hour, minute)
          .inline(),
      );
    } else if (action === 'day') {
      await this.showWeekdays(
        ctx,
        Number(ctx.eventPayload.hour),
        Number(ctx.eventPayload.minute),
        Number(ctx.eventPayload.targetDayOffset),
        [1, 2, 3, 4, 5, 6, 7],
      );
    } else if (action === 'weekday') {
      const weekdays = toggleWeekday(
        parseWeekdays(ctx.eventPayload.weekdays),
        Number(ctx.eventPayload.weekday),
      );
      await this.showWeekdays(
        ctx,
        Number(ctx.eventPayload.hour),
        Number(ctx.eventPayload.minute),
        Number(ctx.eventPayload.targetDayOffset),
        weekdays,
      );
    } else if (action === 'save') {
      try {
        await this.notificationService.upsertFirstNotification(
          ctx.state.userSocial,
          {
            deliveryHour: Number(ctx.eventPayload.hour),
            deliveryMinute: Number(ctx.eventPayload.minute),
            targetDayOffset: Number(
              ctx.eventPayload.targetDayOffset,
            ) as ScheduleNotificationTargetDayOffset,
            weekdays: parseWeekdays(ctx.eventPayload.weekdays),
          },
        );
        await ctx.answer({ type: 'show_snackbar', text: 'Сохранено' });
      } catch (error) {
        await ctx.answer({
          type: 'show_snackbar',
          text: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      await this.openSettings(ctx, true);
    } else if (action === 'enabled') {
      await this.notificationService.setEnabled(
        ctx.state.userSocial.id,
        Number(ctx.eventPayload.notificationId),
        Boolean(ctx.eventPayload.isEnabled),
      );
      await this.openSettings(ctx, true);
    } else if (action === 'deleteConfirm') {
      const notification = await this.notificationService.getFirstNotification(
        ctx.state.userSocial.id,
      );
      if (
        !notification ||
        notification.id !== Number(ctx.eventPayload.notificationId)
      ) {
        await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_ConfirmDelete, {
          groupName: notification.targetId,
        }),
        this.keyboardFactory
          .getScheduleNotificationDeleteConfirmation(
            ctx,
            notification.id,
          )
          .inline(),
      );
    } else if (action === 'delete') {
      await this.notificationService.delete(
        ctx.state.userSocial.id,
        Number(ctx.eventPayload.notificationId),
      );
      await this.openSettings(ctx, true);
    }
  }

  private async openSettings(
    ctx: IMessageContext | IMessageEventContext,
    edit = false,
  ) {
    if (!ctx.state.userSocial.groupName) {
      const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_NeedGroup);
      const keyboard = this.keyboardFactory.getSelectGroup(ctx).inline();
      if (edit && ctx.isMessageEventContext()) {
        await this.editStep(ctx, text, keyboard);
      } else {
        await ctx.send(text, { keyboard });
      }
      return;
    }

    const notification = await this.notificationService.getFirstNotification(
      ctx.state.userSocial.id,
    );
    const notificationView = notification && {
      ...notification,
      weekdaysLabel: getWeekdaysLabel(notification.weekdays),
    };
    const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
      notification: notificationView,
    });
    const keyboard = this.keyboardFactory
      .getScheduleNotificationSettings(ctx, notification)
      .inline();
    if (edit && ctx.isMessageEventContext()) {
      await this.editStep(ctx, text, keyboard);
    } else {
      await ctx.send(text, { keyboard });
    }
  }

  private async showWeekdays(
    ctx: IMessageEventContext,
    hour: number,
    minute: number,
    targetDayOffset: number,
    weekdays: number[],
  ) {
    await this.editStep(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectWeekdays),
      this.keyboardFactory
        .getScheduleNotificationWeekdays(
          ctx,
          hour,
          minute,
          targetDayOffset,
          weekdays,
        )
        .inline(),
    );
  }

  public async openEditor(ctx: IMessageEventContext, notificationId: number) {
    const notification = await this.notificationService.getFirstNotification(
      ctx.state.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
        notification: {
          ...notification,
          weekdaysLabel: getWeekdaysLabel(notification.weekdays),
        },
      }),
      this.keyboardFactory
        .getScheduleNotificationEditor(ctx, notification)
        .inline(),
    );
  }

  private async updateEditorSettings(
    ctx: IMessageEventContext,
    notificationId: number,
    changes: Partial<{
      deliveryHour: number;
      deliveryMinute: number;
      targetDayOffset: ScheduleNotificationTargetDayOffset;
      weekdays: number[];
    }>,
  ) {
    const notification = await this.notificationService.getFirstNotification(
      ctx.state.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.notificationService.updateSettings(
      ctx.state.userSocial.id,
      notificationId,
      {
        deliveryHour: changes.deliveryHour ?? notification.deliveryHour,
        deliveryMinute: changes.deliveryMinute ?? notification.deliveryMinute,
        targetDayOffset:
          changes.targetDayOffset ?? notification.targetDayOffset,
        weekdays: changes.weekdays ?? notification.weekdays,
      },
    );
    await this.openEditor(ctx, notificationId);
  }

  private async editStep(
    ctx: IMessageEventContext,
    message: string,
    keyboard: any,
  ) {
    await ctx.editMessage({ message, keyboard });
  }

}
