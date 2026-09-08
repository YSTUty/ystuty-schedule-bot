import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import { APIError } from 'vk-io';

import { SocialType } from '@my-common/constants';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { VkExceptionFilter } from '@my-common/filter/vk-exception.filter';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleNotifDraftService } from '../../../schedule-notif/schedule-notif-draft.service';
import {
  getScheduleNotifTargetPhrase,
  getWeekdaysLabel,
  parseWeekdays,
  toggleWeekday,
} from '../../../schedule-notif/schedule-notif-ui.util';
import {
  CONVERSATION_SCHEDULE_NOTIF_LIMIT,
  PERSONAL_SCHEDULE_NOTIF_LIMIT,
} from '../../../schedule-notif/schedule-notif.constants';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
  ScheduleNotifTargetType,
} from '../../../schedule-notif/schedule-notif.types';
import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkService } from '../../vk.service';

import { VK_SCHEDULE_NOTIFICATION_GROUP_SCENE } from './vk-schedule-notif-group.scene';
import { VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE } from './vk-schedule-notif-teacher.scene';

@Update()
@UseFilters(VkExceptionFilter)
export class VkScheduleNotifUpdate {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VKKeyboardFactory,
    private readonly vkService: VkService,
  ) {}

  @VkHearsLocale(LocalePhrase.Button_ScheduleNotif)
  @Hears('/notif')
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

    if (action === 'settings') {
      const hasPage = Number.isInteger(Number(ctx.eventPayload.page));
      const page = hasPage ? Number(ctx.eventPayload.page) : 1;
      if (!hasPage) {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Открываю настройки',
        });
        await this.openSettings(ctx);
        return;
      }
      await this.openSettings(ctx, true, page);
      return;
    }

    if (action === 'create') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(ctx).inline(),
      );
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
    } else if (action === 'changeTarget') {
      const notif = await this.getNotif(ctx, Number(ctx.eventPayload.notifId));
      if (!notif) {
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
        this.keyboardFactory
          .getScheduleNotifTargetType(ctx, { notifId: notif.id })
          .inline(),
      );
    } else if (action === 'targetType') {
      const draftId = ctx.eventPayload.draftId;
      if (typeof draftId === 'string') {
        await this.createFromDraft(ctx, draftId);
        return;
      }
      const notifId = Number(ctx.eventPayload.notifId);
      if (ctx.eventPayload.targetType === ScheduleNotifTargetType.Group) {
        await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
          state: { notifId },
        });
      } else if (
        ctx.eventPayload.targetType === ScheduleNotifTargetType.Teacher
      ) {
        await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE, {
          state: { notifId },
        });
      }
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
    } else if (action === 'editTarget' || action === 'editDay') {
      const notif = await this.getNotif(ctx, Number(ctx.eventPayload.notifId));
      if (!notif) {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Рассылка не найдена',
        });
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTarget),
        this.keyboardFactory.getScheduleNotifEditorTarget(ctx, notif).inline(),
      );
    } else if (action === 'editPeriod') {
      const period =
        ctx.eventPayload.period === ScheduleNotifPeriod.Week
          ? ScheduleNotifPeriod.Week
          : ScheduleNotifPeriod.Day;
      await this.updateEditorSettings(ctx, Number(ctx.eventPayload.notifId), {
        period,
        targetDayOffset:
          period === ScheduleNotifPeriod.Week
            ? null
            : (Number(
                ctx.eventPayload.targetDayOffset,
              ) as ScheduleNotifTargetDayOffset),
      });
    } else if (action === 'editWeekdays') {
      const notif = await this.getNotif(ctx, Number(ctx.eventPayload.notifId));
      if (notif) {
        await this.openEditorWeekdays(ctx, notif);
      } else {
        await this.openSettings(ctx, true);
      }
    } else if (action === 'editWeekday') {
      const notif = await this.getNotif(ctx, Number(ctx.eventPayload.notifId));
      if (notif) {
        const weekdays = toggleWeekday(
          notif.weekdays,
          Number(ctx.eventPayload.weekday),
        );
        await this.updateSettings(ctx, notif.id, {
          deliveryHour: notif.deliveryHour,
          deliveryMinute: notif.deliveryMinute,
          period: notif.period ?? ScheduleNotifPeriod.Day,
          targetDayOffset: notif.targetDayOffset,
          weekdays,
        });
        await this.openEditorWeekdays(ctx, { ...notif, weekdays });
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
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTarget),
        this.keyboardFactory.getScheduleNotifTarget(ctx, hour, minute).inline(),
      );
    } else if (action === 'target' || action === 'day') {
      const period =
        action === 'day'
          ? ScheduleNotifPeriod.Day
          : ctx.eventPayload.period === ScheduleNotifPeriod.Week
            ? ScheduleNotifPeriod.Week
            : ScheduleNotifPeriod.Day;
      await this.showWeekdays(
        ctx,
        Number(ctx.eventPayload.hour),
        Number(ctx.eventPayload.minute),
        period,
        period === ScheduleNotifPeriod.Week
          ? null
          : Number(ctx.eventPayload.targetDayOffset),
        period === ScheduleNotifPeriod.Week ? [1] : [1, 2, 3, 4, 5, 6, 7],
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
        ctx.eventPayload.period === ScheduleNotifPeriod.Week
          ? ScheduleNotifPeriod.Week
          : ScheduleNotifPeriod.Day,
        ctx.eventPayload.period === ScheduleNotifPeriod.Week
          ? null
          : Number(ctx.eventPayload.targetDayOffset),
        weekdays,
      );
    } else if (action === 'save') {
      try {
        const settings = {
          deliveryHour: Number(ctx.eventPayload.hour),
          deliveryMinute: Number(ctx.eventPayload.minute),
          period:
            ctx.eventPayload.period === ScheduleNotifPeriod.Week
              ? ScheduleNotifPeriod.Week
              : ScheduleNotifPeriod.Day,
          targetDayOffset:
            ctx.eventPayload.period === ScheduleNotifPeriod.Week
              ? null
              : (Number(
                  ctx.eventPayload.targetDayOffset,
                ) as ScheduleNotifTargetDayOffset),
          weekdays: parseWeekdays(ctx.eventPayload.weekdays),
        };
        const draftId = await this.draftService.create({
          transport: SocialType.Vkontakte,
          ownerId: ctx.senderId || ctx.userId,
          peerId: ctx.peerId,
          userSocialId: ctx.state.userSocial.id,
          settings,
        });
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
          this.keyboardFactory
            .getScheduleNotifTargetType(ctx, { draftId })
            .inline(),
        );
        return;
      } catch (error) {
        await ctx.answer({
          type: 'show_snackbar',
          text: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    } else if (action === 'enabled') {
      await this.setEnabled(
        ctx,
        Number(ctx.eventPayload.notifId),
        Boolean(ctx.eventPayload.isEnabled),
      );
      await this.openSettings(ctx, true);
    } else if (action === 'deleteConfirm') {
      const notif = await this.getNotif(ctx, Number(ctx.eventPayload.notifId));
      if (!notif) {
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
          targetName: this.getTargetLabel(notif),
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
    page = 1,
  ) {
    const notifs = ctx.isDM
      ? await this.notifService.getNotifs(ctx.state.userSocial.id)
      : await this.notifService.getConversationNotifs(
          ctx.state.conversation!.id,
        );
    const notifViews = notifs.map((notif) => this.getNotifView(ctx, notif));
    const text = this.getSettingsText(ctx, notifViews);
    const keyboard = this.keyboardFactory
      .getScheduleNotifSettings(
        ctx,
        notifViews,
        ctx.isDM
          ? notifs.length < PERSONAL_SCHEDULE_NOTIF_LIMIT
          : notifs.length < CONVERSATION_SCHEDULE_NOTIF_LIMIT,
        page,
      )
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
    period: ScheduleNotifPeriod,
    targetDayOffset: number | null,
    weekdays: number[],
  ) {
    await this.editStep(
      ctx,
      ctx.i18n.t(
        period === ScheduleNotifPeriod.Week
          ? LocalePhrase.Page_ScheduleNotif_SelectWeekdaysForWeek
          : LocalePhrase.Page_ScheduleNotif_SelectWeekdays,
      ),
      this.keyboardFactory
        .getScheduleNotifWeekdays(
          ctx,
          hour,
          minute,
          period,
          targetDayOffset,
          weekdays,
        )
        .inline(),
    );
  }

  public async openEditor(ctx: IMessageEventContext, notifId: number) {
    const notif = await this.getNotif(ctx, notifId);
    if (!notif) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
      ctx,
      this.getSettingsText(ctx, [this.getNotifView(ctx, notif)]),
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif).inline(),
    );
  }

  /** Оставляет пользователя в выборе дней после сохранения изменения. */
  private async openEditorWeekdays(
    ctx: IMessageEventContext,
    notif: NonNullable<Awaited<ReturnType<typeof this.getNotif>>>,
  ) {
    await this.editStep(
      ctx,
      this.getSettingsText(ctx, [this.getNotifView(ctx, notif)]),
      this.keyboardFactory.getScheduleNotifEditorWeekdays(ctx, notif).inline(),
    );
  }

  private async updateEditorSettings(
    ctx: IMessageEventContext,
    notifId: number,
    changes: Partial<{
      deliveryHour: number;
      deliveryMinute: number;
      period: ScheduleNotifPeriod;
      targetDayOffset: ScheduleNotifTargetDayOffset | null;
      weekdays: number[];
    }>,
  ) {
    const notif = await this.getNotif(ctx, notifId);
    if (!notif) {
      await ctx.answer({ type: 'show_snackbar', text: 'Рассылка не найдена' });
      await this.openSettings(ctx, true);
      return;
    }
    await this.updateSettings(ctx, notifId, {
      deliveryHour: changes.deliveryHour ?? notif.deliveryHour,
      deliveryMinute: changes.deliveryMinute ?? notif.deliveryMinute,
      period: changes.period ?? notif.period ?? ScheduleNotifPeriod.Day,
      targetDayOffset:
        changes.targetDayOffset !== undefined
          ? changes.targetDayOffset
          : notif.targetDayOffset,
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

  private getNotifView(
    ctx: IMessageContext | IMessageEventContext,
    notif: NonNullable<Awaited<ReturnType<typeof this.getNotif>>>,
  ) {
    return {
      ...notif,
      targetLabel: this.getTargetLabel(notif),
      weekdaysLabel: getWeekdaysLabel(notif.weekdays),
      targetPeriodLabel: ctx.i18n.t(
        getScheduleNotifTargetPhrase(notif.period, notif.targetDayOffset),
      ),
    };
  }

  private getTargetLabel(notif: {
    targetType: ScheduleNotifTargetType;
    targetId: string;
  }) {
    if (notif.targetType === ScheduleNotifTargetType.Teacher) {
      return `Преподаватель: ${this.scheduleService.getTeacherName(Number(notif.targetId)) || notif.targetId}`;
    }
    return `Группа: ${notif.targetId}`;
  }

  private getSettingsText(
    ctx: IMessageContext | IMessageEventContext,
    notifs: ReturnType<VkScheduleNotifUpdate['getNotifView']>[],
  ) {
    const notifsText = notifs
      .map(
        (notif, index) =>
          `${index + 1}. ${notif.targetLabel}\nВремя: ${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')} · ${notif.targetPeriodLabel}\nДни: ${notif.weekdaysLabel} · ${notif.isEnabled ? 'включена' : 'выключена'}`,
      )
      .join('\n\n');
    return ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
      notifsText,
    });
  }

  private async createFromDraft(ctx: IMessageEventContext, draftId: string) {
    if (ctx.eventPayload.targetType === ScheduleNotifTargetType.Teacher) {
      await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE, {
        state: { draftId },
      });
      return;
    }
    await ctx.scene.enter(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
      state: { draftId },
    });
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

  private async getNotif(
    ctx: IMessageContext | IMessageEventContext,
    notifId?: number,
  ) {
    return ctx.isDM
      ? notifId
        ? await this.notifService.getNotif(ctx.state.userSocial.id, notifId)
        : await this.notifService.getFirstNotif(ctx.state.userSocial.id)
      : notifId
        ? await this.notifService.getConversationNotif(
            ctx.state.conversation!.id,
            notifId,
          )
        : await this.notifService.getFirstConversationNotif(
            ctx.state.conversation!.id,
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
