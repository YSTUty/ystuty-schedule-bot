import { Command, Ctx, Update } from 'nestjs-telega';

import { TelegramError } from 'telegraf-hardened';

import { SocialType } from '@my-common/constants';
import { Action, TgHearsLocale } from '@my-common/decorator/tg';
import { LocalePhrase } from '@my-interfaces';
import { ICallbackQueryContext, ICbQOrMsg } from '@my-interfaces/telegram';

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
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TelegramService } from '../../telegram.service';

import { TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE } from './tg-schedule-notif-group.scene';
import { TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE } from './tg-schedule-notif-teacher.scene';

@Update()
export class TgScheduleNotifUpdate {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly scheduleService: ScheduleService,
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
    if (action === 'changeTarget') {
      const notif = await this.getNotif(ctx, Number(params[0]));
      if (!notif) {
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
        this.keyboardFactory.getScheduleNotifTargetType(
          ctx,
          `scheduleNotif:targetType:${notif.id}`,
          true,
          `scheduleNotif:edit:${notif.id}`,
        ),
      );
      return;
    }
    if (action === 'targetType') {
      const notifId = Number(params[0]);
      const targetType = params[1];
      if (targetType === ScheduleNotifTargetType.Group) {
        await ctx.scene.enter(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
          notifId,
        });
        return;
      }
      if (targetType === ScheduleNotifTargetType.Teacher) {
        await ctx.scene.enter(TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE, {
          notifId,
        });
      }
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
      const notif = await this.getNotif(ctx, Number(params[0]));
      if (!notif) {
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
      const notif = await this.getNotif(ctx, Number(params[0]));
      if (!notif) {
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
        const settings = {
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
        };
        const draftId = await this.draftService.create({
          transport: SocialType.Telegram,
          ownerId: ctx.from.id,
          peerId: ctx.chat!.id,
          userSocialId: ctx.userSocial.id,
          settings,
        });
        await this.editStep(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
          this.keyboardFactory.getScheduleNotifTargetType(
            ctx,
            `scheduleNotif:createTarget:${draftId}`,
            true,
          ),
        );
        return;
      } catch (error) {
        await ctx.tryAnswerCbQuery(
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }
    if (action === 'createTarget') {
      const [draftId, targetType] = params;
      if (targetType === ScheduleNotifTargetType.Teacher) {
        await ctx.scene.enter(TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE, {
          draftId,
        });
        return;
      }
      await ctx.scene.enter(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE, {
        draftId,
      });
      return;
    }
    if (action === 'enabled') {
      await this.setEnabled(ctx, Number(params[0]), params[1] === '1');
      await this.openSettings(ctx, true);
      return;
    }
    if (action === 'deleteConfirm') {
      const notif = await this.getNotif(ctx, Number(params[0]));
      if (!notif) {
        await ctx.tryAnswerCbQuery('Рассылка не найдена');
        await this.openSettings(ctx, true);
        return;
      }
      await this.editStep(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_ConfirmDelete, {
          targetName: this.getTargetLabel(notif),
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
    const notifs = this.isConv(ctx)
      ? await this.notifService.getConversationNotifs(ctx.conversation!.id)
      : await this.notifService.getNotifs(ctx.userSocial.id);
    const notifViews = notifs.map((notif) => this.getNotifView(ctx, notif));
    const text = this.getSettingsText(ctx, notifViews);
    const keyboard = this.keyboardFactory.getScheduleNotifSettings(
      ctx,
      notifViews,
      this.isConv(ctx)
        ? notifs.length < CONVERSATION_SCHEDULE_NOTIF_LIMIT
        : notifs.length < PERSONAL_SCHEDULE_NOTIF_LIMIT,
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
    const notif = await this.getNotif(ctx, notifId);
    if (!notif) {
      await ctx.tryAnswerCbQuery('Рассылка не найдена');
      await this.openSettings(ctx, true);
      return;
    }
    await this.editStep(
      ctx,
      this.getSettingsText(ctx, [this.getNotifView(ctx, notif)]),
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
    const notif = await this.getNotif(ctx, notifId);
    if (!notif) {
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
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (error) {
      if (
        error instanceof TelegramError &&
        error.code === 400 &&
        error.description.includes('message is not modified')
      ) {
        return;
      }
      throw error;
    }
  }

  private getNotifView(
    ctx: ICbQOrMsg,
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
    ctx: ICbQOrMsg,
    notifs: ReturnType<TgScheduleNotifUpdate['getNotifView']>[],
  ) {
    const notifsText = notifs
      .map(
        (notif, index) =>
          `${index + 1}. ${notif.targetLabel}\nВремя: <code>${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')}</code> · ${notif.targetPeriodLabel}\nДни: ${notif.weekdaysLabel} · ${notif.isEnabled ? 'включена' : 'выключена'}`,
      )
      .join('\n\n');
    return ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
      notifsText,
    });
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

  private async getNotif(ctx: ICbQOrMsg, notifId?: number) {
    return this.isConv(ctx)
      ? notifId
        ? await this.notifService.getConversationNotif(
            ctx.conversation!.id,
            notifId,
          )
        : await this.notifService.getFirstConversationNotif(
            ctx.conversation!.id,
          )
      : notifId
        ? await this.notifService.getNotif(ctx.userSocial.id, notifId)
        : await this.notifService.getFirstNotif(ctx.userSocial.id);
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
