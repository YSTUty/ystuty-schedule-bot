import {
  Action,
  Ctx,
  Hears,
  SceneEnter,
  Wizard,
  WizardStep,
} from 'nestjs-telega';

import { Markup } from 'telegraf-hardened';
import { InlineKeyboardMarkup } from 'telegraf-hardened/types';

import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';
import { IStepContext } from '@my-interfaces/telegram';

import { ScheduleNotifDraftService } from '../../../schedule-notif/schedule-notif-draft.service';
import {
  getScheduleNotifTargetPhrase,
  getWeekdaysLabel,
} from '../../../schedule-notif/schedule-notif-ui.util';
import { ScheduleNotifService } from '../../../schedule-notif/schedule-notif.service';
import { ScheduleNotifTargetType } from '../../../schedule-notif/schedule-notif.types';
import { ScheduleService } from '../../../schedule/schedule.service';
import { BaseScene } from '../../scene/base.scene';
import { TelegramKeyboardFactory } from '../../telegram-keyboard.factory';
import { TgGroupPicker } from '../tg-group-picker';

export const TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE =
  'TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE';

type ScheduleNotifGroupSceneState = {
  notifId?: number;
  draftId?: string;
};

/** Самостоятельный выбор группы рассылки, не затрагивающий группу профиля. */
@Wizard(TELEGRAM_SCHEDULE_NOTIFICATION_GROUP_SCENE)
export class TgScheduleNotifGroupScene extends BaseScene {
  constructor(
    private readonly notifService: ScheduleNotifService,
    private readonly draftService: ScheduleNotifDraftService,
    private readonly groupPicker: TgGroupPicker,
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {
    super();
  }

  /** Показывает выбор института сразу после входа в сцену. */
  @SceneEnter()
  async onEnter(@Ctx() ctx: IStepContext<ScheduleNotifGroupSceneState>) {
    await this.renderInstitutes(ctx, ctx.scene.state.notifId, 1);
  }

  @WizardStep(1)
  @Hears(/.+/)
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
    notifId: number | undefined,
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
            `sched-notif-group:cancel:${notifId || 0}`,
          ),
        ],
      ],
    });
    await this.editOrReply(ctx, text, keyboard);
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
              `sched-notif-group:cancel:${notifId || 0}`,
            ),
          ],
        ],
      },
    );
    await this.editOrReply(ctx, text, keyboard);
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
      await this.renderNotFound(ctx, groupName);
      return;
    }
    const draftId = ctx.scene.state.draftId;
    if (draftId && ctx.chat) {
      const draft = await this.draftService.consume(draftId, {
        transport: SocialType.Telegram,
        ownerId: ctx.from.id,
        peerId: ctx.chat.id,
      });
      if (!draft || draft.userSocialId !== ctx.userSocial.id) {
        await ctx.tryAnswerCbQuery('Настройка устарела, начни заново');
        await ctx.scene.leave();
        return;
      }
      const target = {
        type: ScheduleNotifTargetType.Group,
        id: selectedGroupName,
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
      await ctx.tryAnswerCbQuery(
        ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Saved),
      );
      await this.renderEditor(ctx, notif.id);
      return;
    }

    if (!notifId) return;
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
    notifId: number | undefined,
  ) {
    const draftId = ctx.scene.state.draftId;
    await ctx.scene.leave();
    if (notifId) {
      await this.renderEditor(ctx, notifId);
      return;
    }
    if (draftId) {
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
  }

  private async renderEditor(
    ctx: IStepContext<ScheduleNotifGroupSceneState>,
    notifId: number,
  ) {
    const notif = this.isConv(ctx)
      ? await this.notifService.getConversationNotif(
          ctx.conversation!.id,
          notifId,
        )
      : await this.notifService.getNotif(ctx.userSocial.id, notifId);
    if (!notif) {
      return;
    }
    await this.editOrReply(
      ctx,
      ctx.i18n.t(LocalePhrase.Page_ScheduleNotif_Settings, {
        notifsText: `1. Группа: ${notif.targetId}\nВремя: <code>${String(notif.deliveryHour).padStart(2, '0')}:${String(notif.deliveryMinute).padStart(2, '0')}</code> · ${ctx.i18n.t(getScheduleNotifTargetPhrase(notif.period, notif.targetDayOffset))}\nДни: ${getWeekdaysLabel(notif.weekdays)} · ${notif.isEnabled ? 'включена' : 'выключена'}`,
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
