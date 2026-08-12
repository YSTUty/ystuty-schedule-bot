import { Logger, UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { type KeyboardBuilder } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { getWeekdaysLabel } from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkGroupPicker } from '../vk-group-picker';

export const VK_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'VK_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotifGroupSceneState = {
  notifId: number;
};

/** Самостоятельный выбор группы для рассылки, не изменяющий группу профиля. */
@Scene(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class VkScheduleNotifGroupScene {
  private readonly logger = new Logger(VkScheduleNotifGroupScene.name);

  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly groupPicker: VkGroupPicker,
    private readonly ystutyService: YSTUtyService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  @AddStep()
  async step(@Ctx() ctx: IStepContext<ScheduleNotifGroupSceneState>) {
    const notifId = ctx.scene.state.notifId;
    const action =
      'eventPayload' in ctx
        ? (ctx.eventPayload.scheduleNotifGroupAction as string | undefined)
        : undefined;

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
        notifId,
        String(ctx.eventPayload.instituteHash),
        Number(ctx.eventPayload.page) || 1,
      );
      return;
    }
    if (action === 'select') {
      await this.selectGroup(ctx, notifId, String(ctx.eventPayload.groupName));
      return;
    }
    if (action === 'cancel') {
      await this.returnToEditor(ctx, notifId);
      return;
    }

    if (ctx.text) {
      await this.selectGroup(ctx, notifId, ctx.text);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    page: number,
  ) {
    const notifId = ctx.scene.state.notifId;
    const { text, keyboard } = this.groupPicker.renderInstitutes(ctx, page, {
      onItem: (instituteHash) => ({
        scheduleNotifGroupAction: 'groups',
        notifId,
        instituteHash,
      }),
      onPage: (_instituteHash, nextPage) => ({
        scheduleNotifGroupAction: 'institutesPage',
        notifId,
        page: nextPage,
      }),
      additionalButtons: [
        [
          this.keyboardFactory.getScheduleNotifGroupPickerCancelButton(
            ctx,
            notifId,
          ),
        ],
      ],
    });
    await this.sendOrEdit(ctx, text, keyboard);
  }

  private async renderGroups(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
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
          notifId,
          groupName,
        }),
        onPage: (hash, nextPage) => ({
          scheduleNotifGroupAction: 'groupsPage',
          notifId,
          instituteHash: hash,
          page: nextPage,
        }),
        additionalButtons: [
          [
            this.keyboardFactory.getInstitutesListButton(ctx, {
              scheduleNotifGroupAction: 'back',
              notifId,
            }),
          ],
          [
            this.keyboardFactory.getScheduleNotifGroupPickerCancelButton(
              ctx,
              notifId,
            ),
          ],
        ],
      },
    );
    await this.sendOrEdit(ctx, text, keyboard);
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
    groupName: string,
  ) {
    const selectedGroupName =
      this.ystutyService.getGroupByName(groupName) ||
      this.ystutyService.parseGroupName(groupName);
    if (!selectedGroupName) {
      await this.renderNotFound(ctx, notifId, groupName);
      return;
    }
    const changed = !ctx.isDM
      ? await this.notifService.changeConversationGroup(
          ctx.state.conversation!.id,
          notifId,
          selectedGroupName,
        )
      : await this.notifService.changeGroup(
          ctx.state.userSocial.id,
          notifId,
          selectedGroupName,
        );
    if (!changed) {
      await this.renderNotFound(ctx, notifId, groupName);
      return;
    }

    await ctx.scene.leave();
    if (ctx.isMessageEventContext()) {
      await ctx.answer({ type: 'show_snackbar', text: 'Группа изменена' });
    }
    await this.renderEditor(ctx, notifId);
  }

  /** Возвращает к редактору только из inline-выбора группы рассылки. */
  private async returnToEditor(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
  ) {
    await ctx.scene.leave();
    await this.renderEditor(ctx, notifId);
  }

  private async renderEditor(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
  ) {
    const notif = !ctx.isDM
      ? await this.notifService.getFirstConversationNotif(
          ctx.state.conversation!.id,
        )
      : await this.notifService.getFirstNotif(ctx.state.userSocial.id);
    if (!notif || notif.id !== notifId) {
      return;
    }
    await this.sendOrEdit(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
        notif: {
          ...notif,
          weekdaysLabel: getWeekdaysLabel(notif.weekdays),
        },
      }),
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif),
    );
  }

  private async renderNotFound(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
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
            notifId,
          }),
        ],
        [
          this.keyboardFactory.getScheduleNotifGroupPickerCancelButton(
            ctx,
            notifId,
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
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
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
