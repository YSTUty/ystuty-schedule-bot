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

const VK_INSTITUTE_GROUPS_SINGLE_PAGE_SIZE = 8;
const VK_ALL_GROUPS_SINGLE_PAGE_SIZE = 10;
const VK_INSTITUTE_GROUPS_TWO_PAGES_SIZE = 7;
const VK_ALL_GROUPS_TWO_PAGES_SIZE = 8;
const VK_INSTITUTE_GROUPS_COMPACT_PAGER_PAGE_SIZE = 6;
const VK_ALL_GROUPS_COMPACT_PAGER_PAGE_SIZE = 7;
// До десяти страниц шесть-семь групп на экране удобнее edge-навигации.
const VK_GROUPS_COMPACT_PAGER_MAX_PAGES = 10;

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
        pagerMode: 'adaptive',
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
    const pagination = this.getGroupsPagination(instituteHash);
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
        pagerMode: pagination.pagerMode,
        groupColumns: pagination.groupColumns,
        adaptiveTwoPagesWithoutCurrent:
          pagination.adaptiveTwoPagesWithoutCurrent,
        adaptiveCompactMaxPages: pagination.adaptiveCompactMaxPages,
        centerButtonToMiddle: true,
      },
      pagination.pageSize,
    );

    await this.sendOrEditGroupList(ctx, text, keyboard);
  }

  /**
   * Размер страницы выбирается до запроса списка. Это сохраняет одинаковые
   * границы страниц и оставляет место для понятного pager со стрелками.
   */
  private getGroupsPagination(instituteHash?: string) {
    const hasInstitute = !!instituteHash;
    const totalGroups = this.scheduleService.groupsCount(instituteHash || null);
    const singlePageSize = hasInstitute
      ? VK_INSTITUTE_GROUPS_SINGLE_PAGE_SIZE
      : VK_ALL_GROUPS_SINGLE_PAGE_SIZE;
    const twoPagesSize = hasInstitute
      ? VK_INSTITUTE_GROUPS_TWO_PAGES_SIZE
      : VK_ALL_GROUPS_TWO_PAGES_SIZE;
    const compactPagerPageSize = hasInstitute
      ? VK_INSTITUTE_GROUPS_COMPACT_PAGER_PAGE_SIZE
      : VK_ALL_GROUPS_COMPACT_PAGER_PAGE_SIZE;
    // Пяти-кнопочная edge-навигация резервирует больше button budget.
    const fullPagerPageSize = hasInstitute ? 4 : 5;

    if (totalGroups <= singlePageSize) {
      return {
        pageSize: singlePageSize,
        groupColumns: 2,
        pagerMode: 'adaptive' as const,
        adaptiveTwoPagesWithoutCurrent: false,
      };
    }

    // Сначала стараемся сохранить индикатор текущей страницы. Убираем его
    // только если одна высвобожденная кнопка позволяет не создавать третью.
    const twoPagesWithIndicatorSize = twoPagesSize - 1;
    if (Math.ceil(totalGroups / twoPagesWithIndicatorSize) === 2) {
      return {
        pageSize: twoPagesWithIndicatorSize,
        groupColumns: 2,
        pagerMode: 'adaptive' as const,
        adaptiveTwoPagesWithoutCurrent: false,
      };
    }

    if (Math.ceil(totalGroups / twoPagesSize) === 2) {
      return {
        pageSize: twoPagesSize,
        groupColumns: 2,
        pagerMode: 'adaptive' as const,
        adaptiveTwoPagesWithoutCurrent: true,
      };
    }

    // Для средних списков используем больше групп и только соседние переходы.
    // Порог передаётся в factory, поэтому режим остаётся настраиваемым.
    if (
      Math.ceil(totalGroups / compactPagerPageSize) <=
      VK_GROUPS_COMPACT_PAGER_MAX_PAGES
    ) {
      return {
        pageSize: compactPagerPageSize,
        groupColumns: 2,
        pagerMode: 'adaptive' as const,
        adaptiveTwoPagesWithoutCurrent: false,
        adaptiveCompactMaxPages: VK_GROUPS_COMPACT_PAGER_MAX_PAGES,
      };
    }

    return {
      pageSize: fullPagerPageSize,
      groupColumns: 2,
      pagerMode: 'edges' as const,
      adaptiveTwoPagesWithoutCurrent: false,
      adaptiveCompactMaxPages: undefined,
    };
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
