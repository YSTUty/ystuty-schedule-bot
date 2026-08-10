import { UseFilters } from '@nestjs/common';
import { Ctx, Next, On, Update } from 'nestjs-vk';

import { NextMiddleware } from 'middleware-io';

import { VkHearsLocale } from '@my-common/decorator/vk';
import { VkExceptionFilter } from '@my-common/filter/vk-exception.filter';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { ScheduleNotificationTargetDayOffset } from '../../../schedule-notification/schedule-notification.types';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

@Update()
@UseFilters(VkExceptionFilter)
export class VkScheduleNotificationUpdate {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly ystutyService: YSTUtyService,
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
    const action = (ctx.eventPayload.scheduleNotificationAction ||
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
    } else if (action === 'changeGroup' || action === 'groups') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_SelectGroup),
        this.keyboardFactory
          .getScheduleNotificationGroups(
            ctx,
            Number(ctx.eventPayload.notificationId),
            this.ystutyService.groupNames,
            Number(ctx.eventPayload.page) || 1,
            Boolean(ctx.eventPayload.returnToEditor),
          )
          .inline(),
      );
    } else if (action === 'group') {
      const changed = await this.notificationService.changeGroup(
        ctx.state.userSocial.id,
        Number(ctx.eventPayload.notificationId),
        String(ctx.eventPayload.groupName),
      );
      await ctx.answer({
        type: 'show_snackbar',
        text: changed ? 'Группа изменена' : 'Рассылка не найдена',
      });
      if (ctx.eventPayload.returnToEditor) {
        await this.openEditor(ctx, Number(ctx.eventPayload.notificationId));
      } else {
        await this.openSettings(ctx, true);
      }
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
    } else if (action === 'editWeekday') {
      const notification = await this.notificationService.getFirstNotification(
        ctx.state.userSocial.id,
      );
      if (
        notification &&
        notification.id === Number(ctx.eventPayload.notificationId)
      ) {
        await this.updateEditorSettings(ctx, notification.id, {
          weekdays: this.toggleWeekday(
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
      const weekdays = this.toggleWeekday(
        this.parseWeekdays(ctx.eventPayload.weekdays),
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
            weekdays: this.parseWeekdays(ctx.eventPayload.weekdays),
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
      if (edit && this.isMessageEventContext(ctx)) {
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
      weekdaysLabel: this.getWeekdaysLabel(notification.weekdays),
    };
    const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
      notification: notificationView,
    });
    const keyboard = this.keyboardFactory
      .getScheduleNotificationSettings(ctx, notification)
      .inline();
    if (edit && this.isMessageEventContext(ctx)) {
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

  private async openEditor(ctx: IMessageEventContext, notificationId: number) {
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
          weekdaysLabel: this.getWeekdaysLabel(notification.weekdays),
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
    await ctx.api.messages.edit({
      peer_id: ctx.peerId,
      cmid: ctx.conversationMessageId,
      message,
      keyboard,
    });
  }

  private isMessageEventContext(
    ctx: IMessageContext | IMessageEventContext,
  ): ctx is IMessageEventContext {
    return 'eventPayload' in ctx && 'answer' in ctx;
  }

  private toggleWeekday(weekdays: number[], weekday: number) {
    return weekdays.includes(weekday)
      ? weekdays.length === 1
        ? weekdays
        : weekdays.filter((item) => item !== weekday)
      : [...weekdays, weekday].sort((first, second) => first - second);
  }

  private parseWeekdays(input: unknown) {
    return Array.isArray(input)
      ? input
          .map(Number)
          .filter(
            (weekday) =>
              Number.isInteger(weekday) && weekday >= 1 && weekday <= 7,
          )
      : [];
  }

  private getWeekdaysLabel(weekdays: number[]) {
    const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return weekdays
      .map((weekday) => labels[weekday - 1])
      .filter(Boolean)
      .join(', ');
  }
}
