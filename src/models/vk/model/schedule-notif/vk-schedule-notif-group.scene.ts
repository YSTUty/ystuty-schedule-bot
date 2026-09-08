import { Logger, UseFilters } from '@nestjs/common';
import { AddStep, Ctx, Scene } from 'nestjs-vk';

import { type KeyboardBuilder } from 'vk-io';

import { VkExceptionFilter } from '@my-common';
import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/vk';

import { ScheduleNotifDraftService } from '../../../schedule-notif/schedule-notif-draft.service';
import {
  getScheduleNotifTargetPhrase,
  getWeekdaysLabel,
} from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleNotifTargetType } from '../../../schedule-notif/schedule-notif.types';
import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { VkGroupPicker } from '../vk-group-picker';

export const VK_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'VK_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotifGroupSceneState = {
  notifId?: number;
  draftId?: string;
};

/** Самостоятельный выбор группы для рассылки, не изменяющий группу профиля. */
@Scene(VK_SCHEDULE_NOTIFICATION_GROUP_SCENE)
@UseFilters(VkExceptionFilter)
export class VkScheduleNotifGroupScene {
  private readonly logger = new Logger(VkScheduleNotifGroupScene.name);

  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly groupPicker: VkGroupPicker,
    private readonly scheduleService: ScheduleService,
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
            notifId || 0,
          ),
        ],
      ],
    });
    await this.sendOrEdit(ctx, text, keyboard);
  }

  private async renderGroups(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number | undefined,
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
              notifId || 0,
            ),
          ],
        ],
      },
    );
    await this.sendOrEdit(ctx, text, keyboard);
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number | undefined,
    groupName: string,
  ) {
    const selectedGroupName =
      this.scheduleService.getGroupByName(groupName) ||
      this.scheduleService.parseGroupName(groupName);
    if (!selectedGroupName) {
      await this.renderNotFound(ctx, notifId, groupName);
      return;
    }
    const draftId = ctx.scene.state.draftId;
    if (draftId) {
      const draft = await this.draftService.consume(draftId, {
        transport: SocialType.Vkontakte,
        ownerId: ctx.senderId || ctx.userId,
        peerId: ctx.peerId,
      });
      if (!draft || draft.userSocialId !== ctx.state.userSocial.id) {
        await ctx.answer({
          type: 'show_snackbar',
          text: 'Настройка устарела, начни заново',
        });
        await ctx.scene.leave({ silent: true });
        return;
      }
      const target = {
        type: ScheduleNotifTargetType.Group,
        id: selectedGroupName,
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
      await ctx.answer({ type: 'show_snackbar', text: 'Сохранено' });
      await ctx.scene.leave({ silent: true });
      await this.renderEditor(ctx, notif.id);
      return;
    }

    if (!notifId) return;
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
    notifId: number | undefined,
  ) {
    const draftId = ctx.scene.state.draftId;
    await ctx.scene.leave({ silent: true });
    if (notifId) {
      await this.renderEditor(ctx, notifId);
      return;
    }
    if (draftId) {
      await this.sendOrEdit(
        ctx,
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_SelectTargetType),
        this.keyboardFactory.getScheduleNotifTargetType(ctx, { draftId }),
      );
    }
  }

  private async renderEditor(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
  ) {
    const notif = !ctx.isDM
      ? await this.notifService.getConversationNotif(
          ctx.state.conversation!.id,
          notifId,
        )
      : await this.notifService.getNotif(ctx.state.userSocial.id, notifId);
    if (!notif) {
      return;
    }
    await this.sendOrEdit(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
        notifsText: `1. Группа: ${notif.targetId}\nВремя: ${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')} · ${ctx.i18n.t(getScheduleNotifTargetPhrase(notif.period, notif.targetDayOffset))}\nДни: ${getWeekdaysLabel(notif.weekdays)} · ${notif.isEnabled ? 'включена' : 'выключена'}`,
      }),
      this.keyboardFactory.getScheduleNotifEditor(ctx, notif),
    );
  }

  private async renderNotFound(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number | undefined,
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
            notifId || 0,
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
