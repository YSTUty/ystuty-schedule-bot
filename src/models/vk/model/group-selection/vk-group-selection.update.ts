import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import { APIError } from 'vk-io';

import { md5, selectGroupCommandRegExp, VkExceptionFilter } from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../../schedule/schedule.service';
import { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../vk.constants';
import { VkService } from '../../vk.service';

import { VkGroupSelectionKeyboardFactory } from './vk-group-selection-keyboard.factory';

@Update()
@UseFilters(VkExceptionFilter)
export class VkGroupSelectionUpdate {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VkGroupSelectionKeyboardFactory,
    private readonly baseKeyboardFactory: VKKeyboardFactory,
    private readonly vkService: VkService,
  ) {}

  @OnMessageEvent({ groupAction: 'institutes' })
  async onGroupInstitutes(@Ctx() ctx: IMessageEventContext) {
    await ctx.scene.leave();
    await this.renderInstitutesList(ctx, Number(ctx.eventPayload.page) || 1);
  }

  @OnMessageEvent({ groupAction: 'groups' })
  async onGroupList(@Ctx() ctx: IMessageEventContext) {
    await this.renderGroupsList(
      ctx,
      String(ctx.eventPayload.instituteHash || '') || undefined,
      Number(ctx.eventPayload.page) || 1,
    );
  }

  @OnMessageEvent({ groupAction: 'select' })
  async onGroupSelect(@Ctx() ctx: IMessageEventContext) {
    const groupName = String(ctx.eventPayload.groupName || '');
    await ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
  }

  @OnMessageEvent({ phrase: LocalePhrase.Button_SelectGroup })
  async onOpenGroupSelect(@Ctx() ctx: IMessageEventContext) {
    await this.renderInstitutesList(ctx);
  }

  @Hears('/institutes')
  @Hears(/^институт(ы)?$/i)
  @VkHearsLocale(LocalePhrase.Button_Groups_ListInstAndGroups)
  async onInstitutesList(@Ctx() ctx: IMessageContext | IMessageEventContext) {
    await this.renderInstitutesList(ctx);
  }

  @Hears('/groups')
  @Hears('/glist')
  // legacy button
  @Hears(/^📚 Список групп 📚$/i)
  @Hears(/^группы$/i)
  async onGroupsList(@Ctx() ctx: IMessageContext | IMessageEventContext) {
    await this.renderGroupsList(ctx);
  }

  /** Отображает институты, оставляя пять строк под элементы и одну под pager. */
  private async renderInstitutesList(
    ctx: IMessageContext | IMessageEventContext,
    page = 1,
  ) {
    const { items, currentPage, totalPages } =
      this.scheduleService.groupsInstitutesList(page, 5);
    const keyboard = this.baseKeyboardFactory.getPagination({
      currentPage,
      totalPages,
      items: items.map((name) => ({
        title: name,
        payload: { groupAction: 'groups', instituteHash: md5(name) },
      })),
      getPagePayload: (nextPage) => ({
        groupAction: 'institutes',
        page: nextPage,
      }),
    });
    const message = ctx.i18n.t(LocalePhrase.Page_SelectGroup_InstitutesList, {
      currentPage,
      totalPages,
    });

    await this.sendOrEditGroupList(ctx, message, keyboard);
  }

  /** Отображает группы выбранного института или общий список по slash-команде. */
  private async renderGroupsList(
    ctx: IMessageContext | IMessageEventContext,
    instituteHash?: string,
    page = 1,
  ) {
    const columnsCount = 2;
    const pageSize = instituteHash ? 4 : 5;
    // TODO: после подтверждения picker рассылки перенести профильный список на общий слой.
    const { items, currentPage, totalPages } = this.scheduleService.groupsList(
      page,
      pageSize,
      instituteHash || null,
    );
    const instituteName = instituteHash
      ? this.scheduleService.instituteNameByHash(instituteHash)
      : undefined;
    const keyboard = this.baseKeyboardFactory.getPagination({
      currentPage,
      totalPages,
      items: this.getGroupListRows(items, columnsCount),
      getPagePayload: (nextPage) => ({
        groupAction: 'groups',
        instituteHash,
        page: nextPage,
      }),
      additionalButtons: instituteHash
        ? [[this.keyboardFactory.getInstitutesListButton(ctx)]]
        : undefined,
    });
    const message = ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
      instituteName,
      currentPage,
      totalPages,
    });

    await this.sendOrEditGroupList(ctx, message, keyboard);
  }

  /** Явно разбивает группы по четыре кнопки, не оставляя это на усмотрение paginator. */
  private getGroupListRows(groupNames: string[], columnsCount: number) {
    return Array.from(
      { length: Math.ceil(groupNames.length / columnsCount) },
      (_, index) =>
        groupNames
          .slice(index * columnsCount, (index + 1) * columnsCount)
          .map((groupName) => ({
            title: groupName,
            payload: { groupAction: 'select', groupName },
          })),
    );
  }

  /** Отправляет новый список или заменяет сообщение, от которого пришёл callback. */
  private async sendOrEditGroupList(
    ctx: IMessageContext | IMessageEventContext,
    message: string,
    keyboard: ReturnType<VKKeyboardFactory['getPagination']>,
  ) {
    const inlineKeyboard = keyboard.inline();

    if (ctx.isMessageEventContext()) {
      await ctx.editMessage({ message, keyboard: inlineKeyboard });
      return;
    }

    await ctx.send(message, { keyboard: inlineKeyboard });
  }

  @VkHearsLocale([
    LocalePhrase.RegExp_Schedule_SelectGroup,
    LocalePhrase.Button_SelectGroup,
  ])
  @Hears(selectGroupCommandRegExp)
  async hearSelectGroup(@Ctx() ctx: IMessageContext) {
    const { senderId, peerId, state } = ctx;
    const groupName = ctx.$match?.groups?.groupName;
    const withTrigger = !!ctx.$match?.groups?.trigger;

    if (ctx.isChat) {
      if (!withTrigger && !state.appeal) {
        return;
      }

      if (
        !state.conversation?.invitedByUserSocialId ||
        state.conversation.invitedByUserSocialId !== state.userSocial.id
      ) {
        try {
          const items = await this.vkService.getCachedConvMembers(peerId);
          const member = items.find((item) => item.member_id === senderId);
          if (!member || !member.is_admin) {
            return ctx.i18n.t(LocalePhrase.Error_SelectGroup_OnlyAdminOrOwner);
          }
        } catch (error) {
          if (error instanceof APIError) {
            if (error.code === 917) {
              return ctx.i18n.t(LocalePhrase.Error_Bot_NotAdmin);
            }
            // return ctx.i18n.t(LocalePhrase.Common_Error);
          }
          throw error;
        }
      }
    }

    if (!groupName) {
      await this.renderInstitutesList(ctx);
      return;
    }

    await ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
  }
}
