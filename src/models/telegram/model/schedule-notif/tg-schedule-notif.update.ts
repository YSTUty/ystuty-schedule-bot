import { Action, Command, Ctx, Update } from 'nestjs-telega';

import { TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext, ICbQOrMsg } from '@my-interfaces/telegram';

import {
  getScheduleNotifTargetPhrase,
  getWeekdaysLabel,
  parseWeekdays,
  toggleWeekday,
} from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import {
  ScheduleNotifPeriod,
  ScheduleNotifTargetDayOffset,
} from '../../../schedule-notif/schedule-notif.types';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TelegramService } from '../../telegram.service';

import { TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE } from './tg-schedule-notif-group.scene';

@Update()
export class TgScheduleNotifUpdate {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
    private readonly telegramService: TelegramService,
  ) {}

  @TgHearsLocale([
    LocalePhrase.Button_ScheduleNotif,
    LocalePhrase.Button_ScheduleNotif_Legacy,
  ])
  @Command('notif')
  @Action(LocalePhrase.Button_ScheduleNotif)
  async openFromMenu(@Ctx() ctx: ICbQOrMsg) {
    if (!(await this.canManage(ctx))) {
      await this.replyNoAccess(ctx);
      return;
    }

    if (ctx.updateType === 'callback_query') {
      await ctx.tryAnswerCbQuery();
    }

    await this.openSettings(ctx);
  }

  @Action(/^scheduleNotif:(?<action>[^:]+)(?::(?<params>.*))?$/)
  async onAction(@Ctx() ctx: ICallbackQueryContext) {
    if (!(await this.canManage(ctx))) {
      await this.replyNoAccess(ctx);
      return;
    }
    const action = ctx.match?.groups?.action;
    const params = ctx.match?.groups?.params?.split(':') || [];
    await ctx.tryAnswerCbQuery();

    if (action === 'create') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(ctx),
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
        notifId: Number(params[0]),
      });
      return;
    }
    if (action === 'editTime') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(ctx, 1, Number(params[0])),
      );
      return;
    }
    if (action === 'editHours') {
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(
          ctx,
          Number(params[1]),
          Number(params[0]),
        ),
      );
      return;
    }
    if (action === 'editHour') {
      const notifId = Number(params[0]);
      const hour = Number(params[1]);
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
        this.keyboardFactory.getScheduleNotifMinutes(ctx, hour, notifId),
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
    if (action === 'editTarget') {
      const notif = await this.getNotif(ctx);
      if (!notif || notif.id !== Number(params[0])) {
        await ctx.tryAnswerCbQuery('Рассылка не найдена');
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTarget),
        this.keyboardFactory.getScheduleNotifEditorTarget(ctx, notif),
      );
      return;
    }
    if (action === 'editPeriod') {
      const period =
        params[1] === ScheduleNotifPeriod.Week
          ? ScheduleNotifPeriod.Week
          : ScheduleNotifPeriod.Day;
      await this.updateEditorSettings(ctx, Number(params[0]), {
        period,
        targetDayOffset:
          period === ScheduleNotifPeriod.Week
            ? null
            : (Number(params[2]) as ScheduleNotifTargetDayOffset),
      });
      return;
    }
    if (action === 'editWeekday') {
      const notif = await this.getNotif(ctx);
      if (!notif || notif.id !== Number(params[0])) {
        await ctx.tryAnswerCbQuery('Рассылка не найдена');
        await this.openSettings(ctx, true);
        return;
      }
      await this.updateEditorSettings(ctx, notif.id, {
        weekdays: toggleWeekday(notif.weekdays, Number(params[1])),
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
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectHour),
        this.keyboardFactory.getScheduleNotifHours(ctx, Number(params[0])),
      );
      return;
    }
    if (action === 'hour') {
      const hour = Number(params[0]);
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
        this.keyboardFactory.getScheduleNotifMinutes(ctx, hour),
      );
      return;
    }
    if (action === 'minute') {
      const hour = Number(params[0]);
      const minute = Number(params[1]);
      if (!Number.isInteger(minute)) {
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectMinute),
          this.keyboardFactory.getScheduleNotifMinutes(ctx, hour),
        );
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTarget),
        this.keyboardFactory.getScheduleNotifTarget(ctx, hour, minute),
      );
      return;
    }
    if (action === 'target' || action === 'day') {
      const period =
        action === 'day'
          ? ScheduleNotifPeriod.Day
          : params[2] === ScheduleNotifPeriod.Week
            ? ScheduleNotifPeriod.Week
            : ScheduleNotifPeriod.Day;
      await this.showWeekdays(
        ctx,
        Number(params[0]),
        Number(params[1]),
        period,
        period === ScheduleNotifPeriod.Week
          ? null
          : Number(action === 'day' ? params[2] : params[3]),
        period === ScheduleNotifPeriod.Week ? [1] : [1, 2, 3, 4, 5, 6, 7],
      );
      return;
    }
    if (action === 'weekday') {
      const isLegacyPayload = params.length === 5;
      const [hour, minute, period, targetDayOffset, weekday, rawWeekdays] =
        isLegacyPayload
          ? [
              params[0],
              params[1],
              ScheduleNotifPeriod.Day,
              params[2],
              params[3],
              params[4],
            ]
          : params;
      const weekdays = toggleWeekday(
        parseWeekdays(rawWeekdays),
        Number(weekday),
      );
      await this.showWeekdays(
        ctx,
        Number(hour),
        Number(minute),
        period === ScheduleNotifPeriod.Week
          ? ScheduleNotifPeriod.Week
          : ScheduleNotifPeriod.Day,
        period === ScheduleNotifPeriod.Week ? null : Number(targetDayOffset),
        weekdays,
      );
      return;
    }
    if (action === 'save') {
      const isLegacyPayload = params.length === 4;
      const [hour, minute, period, targetDayOffset, rawWeekdays] =
        isLegacyPayload
          ? [
              params[0],
              params[1],
              ScheduleNotifPeriod.Day,
              params[2],
              params[3],
            ]
          : params;
      try {
        await this.upsertNotif(ctx, {
          deliveryHour: Number(hour),
          deliveryMinute: Number(minute),
          period:
            period === ScheduleNotifPeriod.Week
              ? ScheduleNotifPeriod.Week
              : ScheduleNotifPeriod.Day,
          targetDayOffset:
            period === ScheduleNotifPeriod.Week
              ? null
              : (Number(targetDayOffset) as ScheduleNotifTargetDayOffset),
          weekdays: parseWeekdays(rawWeekdays),
        });
        await ctx.tryAnswerCbQuery(
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Saved),
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
      await this.setEnabled(ctx, Number(params[0]), params[1] === '1');
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'deleteConfirm') {
      const notif = await this.getNotif(ctx);
      if (!notif || notif.id !== Number(params[0])) {
        await ctx.tryAnswerCbQuery('Рассылка не найдена');
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_ConfirmDelete, {
          groupName: notif.targetId,
        }),
        this.keyboardFactory.getScheduleNotifDeleteConfirmation(ctx, notif.id),
      );
      return;
    }
    if (action === 'delete') {
      await this.deleteNotif(ctx, Number(params[0]));
      await this.openSettings(ctx, true);
    }
  }

  private async openSettings(ctx: ICbQOrMsg, edit = false) {
    if (
      !(this.isConv(ctx)
        ? ctx.conversation?.groupName
        : ctx.userSocial.groupName)
    ) {
      const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_NeedGroup);
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

    const notif = await this.getNotif(ctx);
    const notifView = this.getNotifView(ctx, notif);
    const text = ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
      notif: notifView,
    });
    const keyboard = this.keyboardFactory.getScheduleNotifSettings(
      ctx,
      notif ?? undefined,
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
      this.keyboardFactory.getScheduleNotifWeekdays(
        ctx,
        hour,
        minute,
        period,
        targetDayOffset,
        weekdays,
      ),
    );
  }

  private async openEditor(ctx: ICallbackQueryContext, notifId: number) {
    const notif = await this.getNotif(ctx);
    if (!notif || notif.id !== notifId) {
      await ctx.tryAnswerCbQuery('Рассылка не найдена');
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
        notif: this.getNotifView(ctx, notif),
      }),
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif),
    );
  }

  private async updateEditorSettings(
    ctx: ICallbackQueryContext,
    notifId: number,
    changes: Partial<{
      deliveryHour: number;
      deliveryMinute: number;
      period: ScheduleNotifPeriod;
      targetDayOffset: ScheduleNotifTargetDayOffset | null;
      weekdays: number[];
    }>,
  ) {
    const notif = await this.getNotif(ctx);
    if (!notif || notif.id !== notifId) {
      await ctx.tryAnswerCbQuery('Рассылка не найдена');
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
    ctx: ICallbackQueryContext,
    text: string,
    keyboard: Parameters<ICallbackQueryContext['editMessageText']>[1],
  ) {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }

  private getNotifView(
    ctx: ICbQOrMsg,
    notif: Awaited<ReturnType<typeof this.getNotif>>,
  ) {
    return (
      notif && {
        ...notif,
        weekdaysLabel: getWeekdaysLabel(notif.weekdays),
        targetPeriodLabel: ctx.i18n.t(
          getScheduleNotifTargetPhrase(notif.period, notif.targetDayOffset),
        ),
      }
    );
  }

  private isConv(ctx: ICbQOrMsg) {
    return !!ctx.chat && ctx.chat.type !== 'private';
  }

  private async canManage(ctx: ICbQOrMsg) {
    if (!this.isConv(ctx)) return true;
    if (!ctx.conversation || !ctx.from) return false;
    if (ctx.conversation.invitedByUserSocialId === ctx.userSocial.id)
      return true;
    try {
      const admins = await this.telegramService.getCachedChatAdmins(
        ctx.chat!.id,
      );
      const status = admins.find(
        (item) => item.user.id === ctx.from!.id,
      )?.status;
      return status === 'administrator' || status === 'creator';
    } catch {
      return false;
    }
  }

  private async replyNoAccess(ctx: ICbQOrMsg) {
    if (ctx.updateType === 'callback_query') {
      await ctx.tryAnswerCbQuery(ctx.i18n.t(LocalePhrase.Common_NoAccess));
      return;
    }
    await ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Common_NoAccess));
  }

  private async getNotif(ctx: ICbQOrMsg) {
    return this.isConv(ctx)
      ? await this.notifService.getFirstConversationNotif(ctx.conversation!.id)
      : await this.notifService.getFirstNotif(ctx.userSocial.id);
  }

  private async upsertNotif(
    ctx: ICbQOrMsg,
    settings: Parameters<ScheduleNotifService['upsertFirstNotif']>[1],
  ) {
    return this.isConv(ctx)
      ? await this.notifService.upsertFirstConversationNotif(
          ctx.conversation!,
          settings,
        )
      : await this.notifService.upsertFirstNotif(ctx.userSocial, settings);
  }

  private async setEnabled(
    ctx: ICbQOrMsg,
    notifId: number,
    isEnabled: boolean,
  ) {
    return this.isConv(ctx)
      ? await this.notifService.setConversationEnabled(
          ctx.conversation!.id,
          notifId,
          isEnabled,
        )
      : await this.notifService.setEnabled(
          ctx.userSocial.id,
          notifId,
          isEnabled,
        );
  }

  private async deleteNotif(ctx: ICbQOrMsg, notifId: number) {
    return this.isConv(ctx)
      ? await this.notifService.deleteConversation(
          ctx.conversation!.id,
          notifId,
        )
      : await this.notifService.delete(ctx.userSocial.id, notifId);
  }

  private async updateSettings(
    ctx: ICbQOrMsg,
    notifId: number,
    settings: Parameters<ScheduleNotifService['updateSettings']>[2],
  ) {
    return this.isConv(ctx)
      ? await this.notifService.updateConversationSettings(
          ctx.conversation!.id,
          notifId,
          settings,
        )
      : await this.notifService.updateSettings(
          ctx.userSocial.id,
          notifId,
          settings,
        );
  }
}
