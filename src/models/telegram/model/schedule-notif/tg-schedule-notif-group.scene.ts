import { Action, Ctx, Hears, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/types';

import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { getWeekdaysLabel } from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleService } from '../../../schedule/schedule.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TgGroupPicker } from '../tg-group-picker';

export const TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotifGroupSceneState = {
  notifId: number;
};

/** Самостоятельный выбор группы рассылки, не затрагивающий группу профиля. */
@Wizard(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE)
export class TgScheduleNotifGroupScene extends BaseScene {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly groupPicker: TgGroupPicker,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  @WizardStep(1)
  @Hears(/.+/)
  @Action(/scheduleNotif:changeGroup:[0-9]+/)
  @Action(/sched-notif-group:.+/)
  @Action(/pager:sched-notif:institutes:(?<page>[0-9]+)/)
  @Action(
    /pager:sched-notif:groups:(?<instituteHash>[a-f0-9]{12}):(?<page>[0-9]+)/,
  )
  async step(@Ctx() ctx: IStepContext<ScheduleNotifGroupSceneState>) {
    const notifId = ctx.scene.state.notifId;
    const callbackData =
      ctx.callbackQuery && 'data' in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : undefined;

    if (!callbackData) {
      const groupName =
        ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      if (groupName) {
        await this.selectGroup(ctx, notifId, groupName);
      }
      return;
    }

    if (callbackData.startsWith('scheduleNotif:changeGroup:')) {
      await this.renderInstitutes(ctx, notifId, 1);
      return;
    }

    if (callbackData.startsWith('pager:sched-notif:institutes:')) {
      await this.renderInstitutes(
        ctx,
        notifId,
        Number(callbackData.split(':')[3]) || 1,
      );
      return;
    }
    if (callbackData.startsWith('pager:sched-notif:groups:')) {
      const [, , , instituteHash, page] = callbackData.split(':');
      await this.renderGroups(ctx, notifId, instituteHash, Number(page) || 1);
      return;
    }

    const [, action, firstParam, secondParam] = callbackData.split(':');
    if (action === 'institutes' || action === 'back') {
      await this.renderInstitutes(ctx, notifId, Number(firstParam) || 1);
      return;
    }
    if (action === 'groups') {
      await this.renderGroups(
        ctx,
        notifId,
        firstParam,
        Number(secondParam) || 1,
      );
      return;
    }
    if (action === 'select') {
      await this.selectGroup(
        ctx,
        notifId,
        this.scheduleService.groupNameByHash(firstParam) || '',
      );
      return;
    }
    if (action === 'cancel') {
      await this.returnToEditor(ctx, notifId);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
    page: number,
  ) {
    const { text, keyboard } = this.groupPicker.renderInstitutes(ctx, page, {
      prefix: 'sched-notif-group:',
      pagerName: 'sched-notif:institutes',
      onItem: (instituteHash) => `groups:${instituteHash}:1`,
      additionalButtons: [
        [
          Markup.button.callback(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
            `sched-notif-group:cancel:${notifId}`,
          ),
        ],
      ],
    });
    await this.editOrReply(ctx, text, keyboard);
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
        prefix: 'sched-notif-group:',
        pagerName: (hash) => `sched-notif:groups:${hash}`,
        onItem: (groupHash) => `select:${groupHash}`,
        additionalButtons: [
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
              'sched-notif-group:back:1',
            ),
          ],
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
              `sched-notif-group:cancel:${notifId}`,
            ),
          ],
        ],
      },
    );
    await this.editOrReply(ctx, text, keyboard);
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
    groupName: string,
  ) {
    const selectedGroupName =
      this.scheduleService.getGroupByName(groupName) ||
      this.scheduleService.parseGroupName(groupName);
    if (!selectedGroupName) {
      await this.renderNotFound(ctx, groupName);
      return;
    }
    const changed = this.isConv(ctx)
      ? await this.notifService.changeConversationGroup(
          ctx.conversation!.id,
          notifId,
          selectedGroupName,
        )
      : await this.notifService.changeGroup(
          ctx.userSocial.id,
          notifId,
          selectedGroupName,
        );
    if (!changed) {
      await this.renderNotFound(ctx, groupName);
      return;
    }

    await ctx.scene.leave();
    await ctx.tryAnswerCbQuery('Группа изменена');
    await this.renderEditor(ctx, notifId);
  }

  private async renderNotFound(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    groupName: string,
  ) {
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      this.keyboardFactory.getPagination({
        name: 'schedule-notif-not-found',
        currentPage: 1,
        totalPages: 1,
        items: [],
        additionalButtons: [
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              'sched-notif-group:institutes:1',
            ),
          ],
          [
            Markup.button.callback(
              ctx.i18n.t(LocalePhrase.Button_ScheduleNotif_Back),
              `sched-notif-group:cancel:${ctx.scene.state.notifId}`,
            ),
          ],
        ],
      }),
    );
  }

  /** Возвращает к редактору, не затрагивая глобальную отмену BaseScene. */
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
    const notif = this.isConv(ctx)
      ? await this.notifService.getFirstConversationNotif(ctx.conversation!.id)
      : await this.notifService.getFirstNotif(ctx.userSocial.id);
    if (!notif || notif.id !== notifId) {
      return;
    }
    await this.editOrReply(
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

  private async editOrReply(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
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

  private isConv(ctx: IStepContext<ScheduleNotifGroupSceneState>) {
    return !!ctx.chat && ctx.chat.type !== 'private';
  }
}
