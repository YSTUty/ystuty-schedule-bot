import { Action, Ctx, Hears, Wizard, WizardStep } from 'nestjs-telega';

import { Markup } from 'telegraf-hardened';
import { InlineKeyboardMarkup } from 'telegraf-hardened/types';

import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { ScheduleNotifDraftService } from '../../../schedule-notif/schedule-notif-draft.service';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleNotifTargetType } from '../../../schedule-notif/schedule-notif.types';
import { ScheduleService } from '../../../schedule/schedule.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';

export const TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE =
  'TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE';

type ScheduleNotifTeacherSceneState = {
  draftId?: string;
  notifId?: number;
  query?: string;
};

/** Выбирает преподавателя для отдельной рассылки, не меняя teacherId в session. */
@Wizard(TELEGRAM_SCHEDULE_NOTIFICATION_TEACHER_SCENE)
export class TgScheduleNotifTeacherScene extends BaseScene {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  @Hears(/.+/)
  @Action(/scheduleNotif:(targetType|createTarget):.+:teacher/)
  @Action(/sched-notif-teacher:select:[0-9]+/)
  @Action(/pager:sched-notif-teachers:[0-9]+/)
  @Action('sched-notif-teacher:cancel')
  async step(@Ctx() ctx: IStepContext<ScheduleNotifTeacherSceneState>) {
    const callbackData =
      ctx.callbackQuery && 'data' in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : undefined;
    if (
      callbackData?.startsWith('scheduleNotif:targetType:') ||
      callbackData?.startsWith('scheduleNotif:createTarget:')
    ) {
      await this.renderTeachers(ctx, '', 1);
      return;
    }
    if (callbackData === 'sched-notif-teacher:cancel') {
      const { draftId, notifId } = ctx.scene.state;
      await ctx.scene.leave();
      if (notifId) {
        await this.renderEditor(ctx, notifId);
      } else if (draftId) {
        await this.editOrReply(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
          this.keyboardFactory.getScheduleNotifTargetType(
            ctx,
            `scheduleNotif:createTarget:${draftId}`,
            true,
          ),
        );
      }
      await ctx.tryAnswerCbQuery();
      return;
    }
    if (callbackData?.startsWith('sched-notif-teacher:select:')) {
      await this.selectTeacher(ctx, Number(callbackData.split(':')[2]));
      return;
    }
    if (callbackData?.startsWith('pager:sched-notif-teachers:')) {
      await this.renderTeachers(
        ctx,
        ctx.scene.state.query || '',
        Number(callbackData.split(':')[2]) || 1,
      );
      return;
    }

    const query = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (query) {
      await this.renderTeachers(ctx, query, 1);
    }
  }

  private async renderTeachers(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
    query: string,
    page: number,
  ) {
    const { items, currentPage, totalPages, totalCount } =
      this.scheduleService.teachersList(page, 8, query);
    ctx.scene.state.query = query;
    if (!totalCount) {
      await this.editOrReply(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_TeacherNotFound, { query }),
        this.keyboardFactory.getScheduleNotifTeachersList(ctx, {
          items: [],
          currentPage: 1,
          totalPages: 1,
        }),
      );
      return;
    }

    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTeacher),
      this.keyboardFactory.getScheduleNotifTeachersList(ctx, {
        items,
        currentPage,
        totalPages,
      }),
    );
  }

  private async selectTeacher(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
    teacherId: number,
  ) {
    if (!this.scheduleService.getTeacher(teacherId)) {
      await this.renderTeachers(ctx, ctx.scene.state.query || '', 1);
      return;
    }

    const notifId = ctx.scene.state.notifId;
    if (notifId) {
      const changed = this.isConv(ctx)
        ? await this.notifService.changeConversationTeacher(
            ctx.conversation!.id,
            notifId,
            teacherId,
          )
        : await this.notifService.changeTeacher(
            ctx.userSocial.id,
            notifId,
            teacherId,
          );
      if (!changed) return;
      await ctx.scene.leave();
      await ctx.tryAnswerCbQuery('Преподаватель изменён');
      await this.renderEditor(ctx, notifId);
      return;
    }

    const draftId = ctx.scene.state.draftId;
    const draft =
      draftId && ctx.chat
        ? await this.draftService.consume(draftId, {
            transport: SocialType.Telegram,
            ownerId: ctx.from.id,
            peerId: ctx.chat.id,
          })
        : null;
    if (!draft || draft.userSocialId !== ctx.userSocial.id) {
      await ctx.tryAnswerCbQuery('Настройка устарела, начни заново');
      await ctx.scene.leave();
      return;
    }

    const target = {
      type: ScheduleNotifTargetType.Teacher,
      id: String(teacherId),
    };
    const notif = this.isConv(ctx)
      ? await this.notifService.createForConversation(
          ctx.conversation!,
          target,
          draft.settings,
        )
      : await this.notifService.createForUserSocial(
          ctx.userSocial,
          target,
          draft.settings,
        );
    await ctx.scene.leave();
    await ctx.tryAnswerCbQuery('Рассылка сохранена');
    await this.renderEditor(ctx, notif.id);
  }

  private async editOrReply(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
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

  private async renderEditor(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
    notifId: number,
  ) {
    const notif = this.isConv(ctx)
      ? await this.notifService.getConversationNotif(
          ctx.conversation!.id,
          notifId,
        )
      : await this.notifService.getNotif(ctx.userSocial.id, notifId);
    if (!notif) return;
    const teacherName =
      this.scheduleService.getTeacherName(Number(notif.targetId)) ||
      notif.targetId;
    await this.editOrReply(
      ctx,
      `<b>Рассылка расписания</b>\n1. Преподаватель: ${teacherName}`,
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif),
    );
  }

  private isConv(ctx: IStepContext<ScheduleNotifTeacherSceneState>) {
    return !!ctx.chat && ctx.chat.type !== 'private';
  }
}
