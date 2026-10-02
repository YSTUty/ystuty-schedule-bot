import { UseFilters } from '@nestjs/common';
import { Ctx, Hears, OnMessageEvent, Update } from 'nestjs-vk';

import { APIError } from 'vk-io';

import { selectGroupCommandRegExp, VkExceptionFilter } from '@my-common';
import { VkHearsLocale } from '@my-common/decorator/vk';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext, IMessageEventContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../../schedule/schedule.service';
import type { VKKeyboardFactory } from '../../vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from '../../vk.constants';
import { VkService } from '../../vk.service';

import { VkGroupPicker } from './vk-group-picker';
import { VkGroupSelectionKeyboardFactory } from './vk-group-selection-keyboard.factory';

@Update()
@UseFilters(VkExceptionFilter)
export class VkGroupSelectionUpdate {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VkGroupSelectionKeyboardFactory,
    private readonly groupPicker: VkGroupPicker,
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
    const { text, keyboard } = this.groupPicker.renderInstitutes(
      ctx,
      page,
      {
        onItem: (instituteHash) => ({
          groupAction: 'groups',
          instituteHash,
        }),
        onPage: (_instituteHash, nextPage) => ({
          groupAction: 'institutes',
          page: nextPage,
        }),
        pagerMode: 'edges',
      },
      5,
    );

    await this.sendOrEditGroupList(ctx, text, keyboard);
  }

  /** Отображает группы выбранного института или общий список по slash-команде. */
  private async renderGroupsList(
    ctx: IMessageContext | IMessageEventContext,
    instituteHash?: string,
    page = 1,
  ) {
    const pageSize = instituteHash ? 4 : 5;
    const { text, keyboard } = this.groupPicker.renderGroups(
      ctx,
      instituteHash || null,
      page,
      {
        onItem: (groupName) => ({ groupAction: 'select', groupName }),
        onPage: (hash, nextPage) => ({
          groupAction: 'groups',
          instituteHash: hash,
          page: nextPage,
        }),
        additionalButtons: instituteHash
          ? [[this.keyboardFactory.getInstitutesListButton(ctx)]]
          : undefined,
        pagerMode: 'edges',
        groupColumns: instituteHash ? 2 : 1,
      },
      pageSize,
    );

    await this.sendOrEditGroupList(ctx, text, keyboard);
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
      if (!withTrigger && ctx.isUnaddressedGroupMessage()) {
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
