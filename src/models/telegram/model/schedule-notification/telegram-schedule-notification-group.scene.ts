import { Action, Ctx, Hears, Wizard, WizardStep } from '@xtcry/nestjs-telegraf';

import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/types';

import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { getWeekdaysLabel } from '../../../schedule-notification/schedule-notification-ui.util';
import { ScheduleNotificationService } from '../../../schedule-notification/schedule-notification.service';
import { YSTUtyService } from '../../../ystuty/ystuty.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TgGroupPicker } from '../tg-group-picker';

export const TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotificationGroupSceneState = {
  notificationId: number;
};

/** Самостоятельный выбор группы рассылки, не затрагивающий группу профиля. */
@Wizard(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE)
export class TelegramScheduleNotificationGroupScene extends BaseScene {
  constructor(
    private readonly notificationService: ScheduleNotificationService,
    private readonly groupPicker: TgGroupPicker,
    private readonly ystutyService: YSTUtyService,
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
  async step(@Ctx() ctx: IStepContext<ScheduleNotificationGroupSceneState>) {
    const notificationId = ctx.scene.state.notificationId;
    const callbackData =
      ctx.callbackQuery && 'data' in ctx.callbackQuery
        ? ctx.callbackQuery.data
        : undefined;

    if (!callbackData) {
      const groupName =
        ctx.message && 'text' in ctx.message ? ctx.message.text : '';
      if (groupName) {
        await this.selectGroup(ctx, notificationId, groupName);
      }
      return;
    }

    if (callbackData.startsWith('scheduleNotif:changeGroup:')) {
      await this.renderInstitutes(ctx, notificationId, 1);
      return;
    }

    if (callbackData.startsWith('pager:sched-notif:institutes:')) {
      await this.renderInstitutes(
        ctx,
        notificationId,
        Number(callbackData.split(':')[3]) || 1,
      );
      return;
    }
    if (callbackData.startsWith('pager:sched-notif:groups:')) {
      const [, , , instituteHash, page] = callbackData.split(':');
      await this.renderGroups(
        ctx,
        notificationId,
        instituteHash,
        Number(page) || 1,
      );
      return;
    }

    const [, action, firstParam, secondParam] = callbackData.split(':');
    if (action === 'institutes' || action === 'back') {
      await this.renderInstitutes(ctx, notificationId, Number(firstParam) || 1);
      return;
    }
    if (action === 'groups') {
      await this.renderGroups(
        ctx,
        notificationId,
        firstParam,
        Number(secondParam) || 1,
      );
      return;
    }
    if (action === 'select') {
      await this.selectGroup(
        ctx,
        notificationId,
        this.ystutyService.groupNameByHash(firstParam) || '',
      );
      return;
    }
    if (action === 'cancel') {
      await this.returnToEditor(ctx, notificationId);
    }
  }

  private async renderInstitutes(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    page: number,
  ) {
    const { text, keyboard } = this.groupPicker.renderInstitutes(ctx, page, {
      prefix: 'sched-notif-group:',
      pagerName: 'sched-notif:institutes',
      onItem: (instituteHash) => `groups:${instituteHash}:1`,
      additionalButtons: [
        [
          Markup.button.callback(
            ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
            `sched-notif-group:cancel:${notificationId}`,
          ),
        ],
      ],
    });
    await this.editOrReply(
      ctx,
      text,
      keyboard,
    );
  }

  private async renderGroups(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
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
              ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
              `sched-notif-group:cancel:${notificationId}`,
            ),
          ],
        ],
      },
    );
    await this.editOrReply(ctx, text, keyboard);
  }

  private async selectGroup(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
    groupName: string,
  ) {
    if (!this.ystutyService.getGroupByName(groupName)) {
      await this.renderNotFound(ctx, groupName);
      return;
    }
    const changed = await this.notificationService.changeGroup(
      ctx.userSocial.id,
      notificationId,
      groupName,
    );
    if (!changed) {
      await this.renderNotFound(ctx, groupName);
      return;
    }

    await ctx.scene.leave();
    await ctx.tryAnswerCbQuery('Группа изменена');
    await this.renderEditor(ctx, notificationId);
  }

  private async renderNotFound(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    groupName: string,
  ) {
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, { groupName }),
      this.keyboardFactory.getPagination({
        name: 'schedule-notification-not-found',
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
              ctx.i18n.t(LocalePhrase.Button_ScheduleNotification_Back),
              `sched-notif-group:cancel:${ctx.scene.state.notificationId}`,
            ),
          ],
        ],
      }),
    );
  }

  /** Возвращает к редактору, не затрагивая глобальную отмену BaseScene. */
  private async returnToEditor(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
  ) {
    await ctx.scene.leave();
    await this.renderEditor(ctx, notificationId);
  }

  private async renderEditor(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
    notificationId: number,
  ) {
    const notification = await this.notificationService.getFirstNotification(
      ctx.userSocial.id,
    );
    if (!notification || notification.id !== notificationId) {
      return;
    }
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotification_Settings, {
        notification: {
          ...notification,
          weekdaysLabel: getWeekdaysLabel(notification.weekdays),
        },
      }),
      this.keyboardFactory.getScheduleNotificationEditor(ctx, notification),
    );
  }

  private async editOrReply(
    ctx: IStepContext<ScheduleNotificationGroupSceneState>,
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
}
