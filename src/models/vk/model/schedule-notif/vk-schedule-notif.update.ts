import { UseFilters } from '@nestjs/common';
import { Ctx, OnMessageEvent, Update } from 'nestjs-vk';

import { APIError } from 'vk-io';

import { VkHearsLocale } from '@my-common/decorator/vk';
import { VkExceptionFilter } from '@my-common/filter/vk-exception.filter';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import {
  getWeekdaysLabel,
  parseWeekdays,
  toggleWeekday,
} from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleNotifTargetDayOffset } from '../../../schedule-notif/schedule-notif.types';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkService } from '../../vk.service';

import { VK_SCHEDULE_NOTIFICATION_GROUP_SCENE } from './vk-schedule-notif-group.scene';

@Update()
@UseFilters(VkExceptionFilter)
export class VkScheduleNotifUpdate {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly vkService: VkService,
  ) {}

  @VkHearsLocale(LocalePhrase.Button_ScheduleNotif)
  async openFromMenu(@Ctx() ctx: IMessageContext) {
    if (!(await this.canManage(ctx))) {
      await ctx.send(ctx.i18n.t(LocalePhrase.Common_NoAccess));
      return;
    }
    await this.openSettings(ctx);
  }

  @OnMessageEvent(
    (payload) =>
      'scheduleNotifAction' in payload ||
      payload.phrase === LocalePhrase.Button_ScheduleNotif,
  )
  async onMessageEvent(@Ctx() ctx: IMessageEventContext) {
    const action = (ctx.eventPayload.scheduleNotifAction ||
      (ctx.eventPayload.phrase === LocalePhrase.Button_ScheduleNotif &&
        'settings')) as string | undefined;
    if (!(await this.canManage(ctx))) {
      await ctx.answer({
        type: 'show_snackbar',
        text: ctx.i18n.t(LocalePhrase.Common_NoAccess),
      });
      return;
    }

    if (action === 'create') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(ctx).inline(),
      );
    } else if (action === 'settings') {
      // Основная VK-клавиатура не всегда передаёт cmid исходного сообщения.
      // Поэтому вход в настройки создаёт отдельное inline-сообщение для шагов wizard.
      await this.openSettings(ctx);
    } else if (action === 'edit') {
      await this.openEditor(ctx, Number(ctx.eventPayload.notifId));
    } else if (action === 'hours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory
          .getScheduleNotifHours(ctx, Number(ctx.eventPayload.page))
          .inline(),
      );
    } else if (action === 'editHours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory
          .getScheduleNotifHours(
            ctx,
            Number(ctx.eventPayload.page),
            Number(ctx.eventPayload.notifId),
          )
          .inline(),
      );
    } else if (action === 'changeGroup') {
      await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
        state: { notifId: Number(ctx.eventPayload.notifId) },
      });
    } else if (action === 'editTime') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory
          .getScheduleNotifHours(ctx, 1, Number(ctx.eventPayload.notifId))
          .inline(),
      );
    } else if (action === 'editHour') {
      const notifId = Number(ctx.eventPayload.notifId);
      const hour = Number(ctx.eventPayload.hour);
      if (Number.isInteger(hour)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
          this.keyboardFactory
            .getScheduleNotifMinutes(ctx, hour, notifId)
            .inline(),
        );
      } else {
        await this.openEditor(ctx, notifId);
      }
    } else if (action === 'editMinute') {
      await this.updateEditorSettings(ctx, Number(ctx.eventPayload.notifId), {
        deliveryHour: Number(ctx.eventPayload.hour),
        deliveryMinute: Number(ctx.eventPayload.minute),
      });
    } else if (action === 'editDay') {
      await this.updateEditorSettings(ctx, Number(ctx.eventPayload.notifId), {
        targetDayOffset: Number(
          ctx.eventPayload.targetDayOffset,
        ) as ScheduleNotifTargetDayOffset,
      });
    } else if (action === 'editWeekdays') {
      const notif = await this.getNotif(ctx);
      if (notif && notif.id === Number(ctx.eventPayload.notifId)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
            notif: {
              ...notif,
              weekdaysLabel: getWeekdaysLabel(notif.weekdays),
            },
          }),
          this.keyboardFactory
            .getScheduleNotifEditorWeekdays(ctx, notif)
            .inline(),
        );
      } else {
        await this.openSettings(ctx, true);
      }
    } else if (action === 'editWeekday') {
      const notif = await this.getNotif(ctx);
      if (notif && notif.id === Number(ctx.eventPayload.notifId)) {
        await this.updateEditorSettings(ctx, notif.id, {
          weekdays: toggleWeekday(
            notif.weekdays,
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
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
        this.keyboardFactory
          .getScheduleNotifMinutes(ctx, Number(ctx.eventPayload.hour))
          .inline(),
      );
    } else if (action === 'minute') {
      const hour = Number(ctx.eventPayload.hour);
      const minute = Number(ctx.eventPayload.minute);
      if (!Number.isInteger(minute)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
          this.keyboardFactory.getScheduleNotifMinutes(ctx, hour).inline(),
        );
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetDay),
        this.keyboardFactory
          .getScheduleNotifTargetDay(ctx, hour, minute)
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
        await this.upsertNotif(ctx, {
          deliveryHour: Number(ctx.eventPayload.hour),
          deliveryMinute: Number(ctx.eventPayload.minute),
          targetDayOffset: Number(
            ctx.eventPayload.targetDayOffset,
          ) as ScheduleNotifTargetDayOffset,
          weekdays: parseWeekdays(ctx.eventPayload.weekdays),
        });
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
      await this.setEnabled(
        ctx,
        Number(ctx.eventPayload.notifId),
        Boolean(ctx.eventPayload.isEnabled),
      );
      await this.openSettings(ctx, true);
    } else if (action === 'deleteConfirm') {
      const notif = await this.getNotif(ctx);
      if (!notif || notif.id !== Number(ctx.eventPayload.notifId)) {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Рассылка не найдена',
        });
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_ConfirmDelete, {
          groupName: notif.targetId,
        }),
        this.keyboardFactory
          .getScheduleNotifDeleteConfirmation(ctx, notif.id)
          .inline(),
      );
    } else if (action === 'delete') {
      await this.deleteNotif(ctx, Number(ctx.eventPayload.notifId));
      await this.openSettings(ctx, true);
    }
  }

  private async openSettings(
    ctx: IMessageContext | IMessageEventContext,
    edit = false,
  ) {
    if (
      !(ctx.isDM
        ? ctx.state.userSocial.groupName
        : ctx.state.conversation?.groupName)
    ) {
      const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_NeedGroup);
      const keyboard = this.keyboardFactory.getSelectGroup(ctx).inline();
      if (edit && ctx.isMessageEventContext()) {
        await this.editStep(ctx, text, keyboard);
      } else {
        await ctx.send(text, { keyboard });
      }
      return;
    }

    const notif = await this.getNotif(ctx);
    const notifView = notif && {
      ...notif,
      weekdaysLabel: getWeekdaysLabel(notif.weekdays),
    };
    const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
      notif: notifView,
    });
    const keyboard = this.keyboardFactory
      .getScheduleNotifSettings(ctx, notif ?? undefined)
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
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectWeekdays),
      this.keyboardFactory
        .getScheduleNotifWeekdays(ctx, hour, minute, targetDayOffset, weekdays)
        .inline(),
    );
  }

  public async openEditor(ctx: IMessageEventContext, notifId: number) {
    const notif = await this.getNotif(ctx);
    if (!notif || notif.id !== notifId) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
        notif: {
          ...notif,
          weekdaysLabel: getWeekdaysLabel(notif.weekdays),
        },
      }),
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif).inline(),
    );
  }

  private async updateEditorSettings(
    ctx: IMessageEventContext,
    notifId: number,
    changes: Partial<{
      deliveryHour: number;
      deliveryMinute: number;
      targetDayOffset: ScheduleNotifTargetDayOffset;
      weekdays: number[];
    }>,
  ) {
    const notif = await this.getNotif(ctx);
    if (!notif || notif.id !== notifId) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.updateSettings(ctx, notifId, {
      deliveryHour: changes.deliveryHour ?? notif.deliveryHour,
      deliveryMinute: changes.deliveryMinute ?? notif.deliveryMinute,
      targetDayOffset: changes.targetDayOffset ?? notif.targetDayOffset,
      weekdays: changes.weekdays ?? notif.weekdays,
    });
    await this.openEditor(ctx, notifId);
  }

  private async editStep(
    ctx: IMessageEventContext,
    message: string,
    keyboard: any,
  ) {
    await ctx.editMessage({ message, keyboard });
  }

  private async canManage(ctx: IMessageContext | IMessageEventContext) {
    if (ctx.isDM) return true;
    const conversation = ctx.state.conversation;
    if (!conversation) return false;
    if (conversation.invitedByUserSocialId === ctx.state.userSocial.id) {
      return true;
    }
    try {
      const items = await this.vkService.getCachedConvMembers(ctx.peerId);
      return !!items.find(
        (item) =>
          item.member_id === (ctx.senderId || ctx.userId) && item.is_admin,
      );
    } catch (error) {
      if (error instanceof APIError && error.code === 917) return false;
      return false;
    }
  }

  private async getNotif(ctx: IMessageContext | IMessageEventContext) {
    return ctx.isDM
      ? await this.notifService.getFirstNotif(ctx.state.userSocial.id)
      : await this.notifService.getFirstConversationNotif(
          ctx.state.conversation!.id,
        );
  }

  private async upsertNotif(
    ctx: IMessageEventContext,
    settings: Parameters<ScheduleNotifService['upsertFirstNotif']>[1],
  ) {
    return ctx.isDM
      ? await this.notifService.upsertFirstNotif(ctx.state.userSocial, settings)
      : await this.notifService.upsertFirstConversationNotif(
          ctx.state.conversation!,
          settings,
        );
  }

  private async setEnabled(
    ctx: IMessageEventContext,
    notifId: number,
    isEnabled: boolean,
  ) {
    return ctx.isDM
      ? await this.notifService.setEnabled(
          ctx.state.userSocial.id,
          notifId,
          isEnabled,
        )
      : await this.notifService.setConversationEnabled(
          ctx.state.conversation!.id,
          notifId,
          isEnabled,
        );
  }

  private async deleteNotif(ctx: IMessageEventContext, notifId: number) {
    return ctx.isDM
      ? await this.notifService.delete(ctx.state.userSocial.id, notifId)
      : await this.notifService.deleteConversation(
          ctx.state.conversation!.id,
          notifId,
        );
  }

  private async updateSettings(
    ctx: IMessageEventContext,
    notifId: number,
    settings: Parameters<ScheduleNotifService['updateSettings']>[2],
  ) {
    return ctx.isDM
      ? await this.notifService.updateSettings(
          ctx.state.userSocial.id,
          notifId,
          settings,
        )
      : await this.notifService.updateConversationSettings(
          ctx.state.conversation!.id,
          notifId,
          settings,
        );
  }
}
