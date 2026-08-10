import { Action, Ctx, Update } from '@xtcry/nestjs-telegraf';

import { TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext, ICbQOrMsg } from '@my-interfaces/telegram';

import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { ScheduleNotificationTargetDayOffset } from '../../../schedule-notification/schedule-notification.types';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

import {
  TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE,
  TelegramScheduleNotificationGroupScene,
} from './telegram-schedule-notification-group.scene';

@Update()
export class TelegramScheduleNotificationUpdate {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly groupScene: TelegramScheduleNotificationGroupScene,
  ) {}

  @TgHearsLocale(LocalePhrase.Button_ScheduleNotification)
  async openFromMenu(@Ctx() ctx: ICbQOrMsg) {
    await this.openSettings(ctx);
  }

  @Action(/^scheduleNotification:(?<action>[^:]+)(?::(?<params>.*))?$/)
  async onAction(@Ctx() ctx: ICallbackQueryContext) {
    if (ctx.chat?.type !== 'private') {
      return;
    }
    const action = ctx.match?.groups?.action;
    const params = ctx.match?.groups?.params?.split(':') || [];
    await ctx.tryAnswerCbQuery();

    if (action === 'create') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory.getScheduleNotificationHours(ctx),
      );
      return;
    }
    if (action === 'settings') {
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'edit') {
      await this.openEditor(ctx, Number(params[0]));
      return;
    }
    if (action === 'changeGroup') {
      await ctx.scene.enter(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
        notificationId: Number(params[0]),
      });
      await this.groupScene.open(ctx);
      return;
    }
    if (action === 'editTime') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory.getScheduleNotificationHours(
          ctx,
          1,
          Number(params[0]),
        ),
      );
      return;
    }
    if (action === 'editHours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory.getScheduleNotificationHours(
          ctx,
          Number(params[1]),
          Number(params[0]),
        ),
      );
      return;
    }
    if (action === 'editHour') {
      const notificationId = Number(params[0]);
      const hour = Number(params[1]);
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
        this.keyboardFactory.getScheduleNotificationMinutes(
          ctx,
          hour,
          notificationId,
        ),
      );
      return;
    }
    if (action === 'editMinute') {
      await this.updateEditorSettings(ctx, Number(params[0]), {
        deliveryHour: Number(params[1]),
        deliveryMinute: Number(params[2]),
      });
      return;
    }
    if (action === 'editDay') {
      await this.updateEditorSettings(ctx, Number(params[0]), {
        targetDayOffset: Number(
          params[1],
        ) as ScheduleNotificationTargetDayOffset,
      });
      return;
    }
    if (action === 'editWeekday') {
      const notification = await this.notificationService.getFirstNotification(
        ctx.userSocial.id,
      );
      if (!notification || notification.id !== Number(params[0])) {
        await ctx.tryAnswerCbQuery('Рассылка не найдена');
        await this.openSettings(ctx, true);
        return;
      }
      await this.updateEditorSettings(ctx, notification.id, {
        weekdays: this.toggleWeekday(
          notification.weekdays.join(','),
          Number(params[1]),
        ),
      });
      return;
    }
    if (action === 'editSave') {
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'hours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectHour),
        this.keyboardFactory.getScheduleNotificationHours(
          ctx,
          Number(params[0]),
        ),
      );
      return;
    }
    if (action === 'hour') {
      const hour = Number(params[0]);
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
        this.keyboardFactory.getScheduleNotificationMinutes(ctx, hour),
      );
      return;
    }
    if (action === 'minute') {
      const hour = Number(params[0]);
      const minute = Number(params[1]);
      if (!Number.isInteger(minute)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectMinute),
          this.keyboardFactory.getScheduleNotificationMinutes(ctx, hour),
        );
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectTargetDay),
        this.keyboardFactory.getScheduleNotificationTargetDay(
          ctx,
          hour,
          minute,
        ),
      );
      return;
    }
    if (action === 'day') {
      await this.showWeekdays(
        ctx,
        Number(params[0]),
        Number(params[1]),
        Number(params[2]),
        [1, 2, 3, 4, 5, 6, 7],
      );
      return;
    }
    if (action === 'weekday') {
      const [hour, minute, targetDayOffset, weekday, rawWeekdays] = params;
      const weekdays = this.toggleWeekday(rawWeekdays, Number(weekday));
      await this.showWeekdays(
        ctx,
        Number(hour),
        Number(minute),
        Number(targetDayOffset),
        weekdays,
      );
      return;
    }
    if (action === 'save') {
      const [hour, minute, targetDayOffset, rawWeekdays] = params;
      try {
        await this.notificationService.upsertFirstNotification(ctx.userSocial, {
          deliveryHour: Number(hour),
          deliveryMinute: Number(minute),
          targetDayOffset: Number(
            targetDayOffset,
          ) as ScheduleNotificationTargetDayOffset,
          weekdays: this.parseWeekdays(rawWeekdays),
        });
        await ctx.tryAnswerCbQuery(
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Saved),
        );
      } catch (error) {
        await ctx.tryAnswerCbQuery(
          error instanceof Error ? error.message : String(error),
        );
      }
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'enabled') {
      await this.notificationService.setEnabled(
        ctx.userSocial.id,
        Number(params[0]),
        params[1] === '1',
      );
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'deleteConfirm') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_ConfirmDelete),
        this.keyboardFactory.getScheduleNotificationDeleteConfirmation(
          ctx,
          Number(params[0]),
        ),
      );
      return;
    }
    if (action === 'delete') {
      await this.notificationService.delete(
        ctx.userSocial.id,
        Number(params[0]),
      );
      await this.openSettings(ctx, true);
    }
  }

  private async openSettings(ctx: ICbQOrMsg, edit = false) {
    if (!ctx.userSocial.groupName) {
      const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_NeedGroup);
      if (edit && ctx.updateType === 'callback_query') {
        await ctx.editMessageText(
          text,
          this.keyboardFactory.getSelectGroupInline(ctx),
        );
      } else {
        await ctx.replyWithHTML(
          text,
          this.keyboardFactory.getSelectGroupInline(ctx),
        );
      }
      return;
    }

    const notification = await this.notificationService.getFirstNotification(
      ctx.userSocial.id,
    );
    const notificationView = notification && {
      ...notification,
      weekdaysLabel: this.getWeekdaysLabel(notification.weekdays),
    };
    const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
      notification: notificationView,
    });
    const keyboard = this.keyboardFactory.getScheduleNotificationSettings(
      ctx,
      notification,
    );
    if (edit && ctx.updateType === 'callback_query') {
      await this.editStep(ctx, text, keyboard);
    } else {
      await ctx.replyWithHTML(text, keyboard);
    }
  }

  private async showWeekdays(
    ctx: ICallbackQueryContext,
    hour: number,
    minute: number,
    targetDayOffset: number,
    weekdays: number[],
  ) {
    await this.editStep(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectWeekdays),
      this.keyboardFactory.getScheduleNotificationWeekdays(
        ctx,
        hour,
        minute,
        targetDayOffset,
        weekdays,
      ),
    );
  }

  private async openEditor(ctx: ICallbackQueryContext, notificationId: number) {
    const notification = await this.notificationService.getFirstNotification(
      ctx.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      await ctx.tryAnswerCbQuery('Рассылка не найдена');
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
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

  private async updateEditorSettings(
    ctx: ICallbackQueryContext,
    notificationId: number,
    changes: Partial<{
      deliveryHour: number;
      deliveryMinute: number;
      targetDayOffset: ScheduleNotificationTargetDayOffset;
      weekdays: number[];
    }>,
  ) {
    const notification = await this.notificationService.getFirstNotification(
      ctx.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      await ctx.tryAnswerCbQuery('Рассылка не найдена');
      await this.openSettings(ctx, true);
      return;
    }
    await this.notificationService.updateSettings(
      ctx.userSocial.id,
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
    ctx: ICallbackQueryContext,
    text: string,
    keyboard: Parameters<ICallbackQueryContext['editMessageText']>[1],
  ) {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }

  private toggleWeekday(rawWeekdays: string | undefined, weekday: number) {
    const weekdays = this.parseWeekdays(rawWeekdays);
    return weekdays.includes(weekday)
      ? weekdays.length === 1
        ? weekdays
        : weekdays.filter((item) => item !== weekday)
      : [...weekdays, weekday].sort((first, second) => first - second);
  }

  private parseWeekdays(rawWeekdays: string | undefined) {
    return (rawWeekdays || '')
      .split(',')
      .map(Number)
      .filter(
        (weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7,
      );
  }

  private getWeekdaysLabel(weekdays: number[]) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return weekdays
      .map((weekday) => labels[weekday - 1])
      .filter(Boolean)
      .join(', ');
  }
}
