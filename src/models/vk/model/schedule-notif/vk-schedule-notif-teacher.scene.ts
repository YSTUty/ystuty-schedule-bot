import { UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { type KeyboardBuilder } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { ScheduleNotifDraftService } from '../../../schedule-notif/schedule-notif-draft.service';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleNotifTargetType } from '../../../schedule-notif/schedule-notif.types';
import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';

export const VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE =
  'VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE';

type ScheduleNotifTeacherSceneState = {
  draftId?: string;
  notifId?: number;
  query?: string;
};

/** Выбирает преподавателя для рассылки без изменения глобального выбора преподавателя. */
@Scene(VK_SCHEDULE_NOTIFICATION_TEACHER_SCENE)
@UseFilters(VkExceptionFilter)
export class VkScheduleNotifTeacherScene {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step(@Ctx() ctx: IStepContext<ScheduleNotifTeacherSceneState>) {
    if (ctx.scene.step.firstTime) {
      await this.renderTeachers(ctx, '', 1);
      return;
    }

    const action = ctx.isMessageEventContext()
      ? (ctx.eventPayload.scheduleNotifTeacherAction as string | undefined)
      : undefined;
    if (action === 'cancel') {
      const { draftId, notifId } = ctx.scene.state;
      await ctx.scene.leave({ silent: true });
      if (notifId) {
        await this.renderEditor(ctx, notifId);
      } else if (draftId) {
        await this.sendOrEdit(
          ctx,
          ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
          this.keyboardFactory.getScheduleNotifTargetType(ctx, { draftId }),
        );
      }
      return;
    }
    if (action === 'select') {
      await this.selectTeacher(ctx, Number(ctx.eventPayload.teacherId));
      return;
    }
    if (action === 'page') {
      await this.renderTeachers(
        ctx,
        ctx.scene.state.query || '',
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }
    if (ctx.text) {
      await this.renderTeachers(ctx, ctx.text, 1);
    }
  }

  private async renderTeachers(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
    query: string,
    page: number,
  ) {
    const { items, currentPage, totalPages, totalCount } =
      this.scheduleService.teachersList(page, 4, query);
    ctx.scene.state.query = query;
    const text = totalCount
      ? ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTeacher)
      : ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_TeacherNotFound, { query });
    await this.sendOrEdit(
      ctx,
      text,
      this.keyboardFactory.getScheduleNotifTeachersList({
        ctx,
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
      const changed = ctx.isDM
        ? await this.notifService.changeTeacher(
            ctx.state.userSocial.id,
            notifId,
            teacherId,
          )
        : await this.notifService.changeConversationTeacher(
            ctx.state.conversation!.id,
            notifId,
            teacherId,
          );
      if (changed) {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Преподаватель изменён',
        });
      }
      await ctx.scene.leave({ silent: true });
      await this.renderEditor(ctx, notifId);
      return;
    }

    const draftId = ctx.scene.state.draftId;
    const draft = draftId
      ? await this.draftService.consume(draftId, {
          transport: SocialType.Vkontakte,
          ownerId: ctx.senderId || ctx.userId,
          peerId: ctx.peerId,
        })
      : null;
    if (!draft || draft.userSocialId !== ctx.state.userSocial.id) {
      await ctx.answer({
        type: 'show_snackbar',
        text: 'Настройка устарела, начни заново',
      });
      await ctx.scene.leave({ silent: true });
      return;
    }

    const target = {
      type: ScheduleNotifTargetType.Teacher,
      id: String(teacherId),
    };
    const notif = ctx.isDM
      ? await this.notifService.createForUserSocial(
          ctx.state.userSocial,
          target,
          draft.settings,
        )
      : await this.notifService.createForConversation(
          ctx.state.conversation!,
          target,
          draft.settings,
        );
    await ctx.answer({ type: 'show_snackbar', text: 'Рассылка сохранена' });
    await ctx.scene.leave({ silent: true });
    await this.renderEditor(ctx, notif.id);
  }

  private async sendOrEdit(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
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

  private async renderEditor(
    ctx: IStepContext<ScheduleNotifTeacherSceneState>,
    notifId: number,
  ) {
    const notif = ctx.isDM
      ? await this.notifService.getNotif(ctx.state.userSocial.id, notifId)
      : await this.notifService.getConversationNotif(
          ctx.state.conversation!.id,
          notifId,
        );
    if (!notif) return;
    const teacherName =
      this.scheduleService.getTeacherName(Number(notif.targetId)) ||
      notif.targetId;
    await this.sendOrEdit(
      ctx,
      `Рассылка расписания\n1. Преподаватель: ${teacherName}`,
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif),
    );
  }
}
