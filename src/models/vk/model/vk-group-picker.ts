import { Injectable } from '@nestjs/common';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../schedule/schedule.service';
import { VKKeyboardFactory, VKPaginationOptions } from '../vk-keyboard.factory';

type VkPickerButtons = VKPaginationOptions['additionalButtons'];

type VkPickerOptions = {
  onItem: (value: string) => Record<string, unknown>;
  onPage: (hash: string | undefined, page: number) => Record<string, unknown>;
  additionalButtons?: VkPickerButtons;
};

/** Рендерит VK-списки институтов и групп, сохраняя лимиты inline-клавиатуры. */
@Injectable()
export class VkGroupPicker {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: VKKeyboardFactory,
  ) {}

  public renderInstitutes(
    ctx: IContext,
    page: number,
    options: VkPickerOptions,
    count = 4,
  ) {
    const { items, currentPage, totalPages } =
      this.scheduleService.groupsInstitutesList(page, count);
    return {
      text: ctx.i18n.t(LocalePhrase.Page_SelectGroup_InstitutesList, {
        currentPage,
        totalPages,
      }),
      keyboard: this.keyboardFactory.getPagination({
        currentPage,
        totalPages,
        // Длинные названия институтов оставляем в отдельных строках.
        items: items.map((title) => ({
          title,
          payload: options.onItem(md5(title).slice(0, 12)),
        })),
        getPagePayload: (nextPage) => options.onPage(undefined, nextPage),
        additionalButtons: options.additionalButtons || [],
        pagerMode: 'compact',
      }),
    };
  }

  public renderGroups(
    ctx: IContext,
    instituteHash: string,
    page: number,
    options: VkPickerOptions,
    count = 4,
  ) {
    const { items, currentPage, totalPages } = this.scheduleService.groupsList(
      page,
      count,
      instituteHash,
    );
    const rows = Array.from(
      { length: Math.ceil(items.length / 2) },
      (_, index) =>
        items.slice(index * 2, (index + 1) * 2).map((title) => ({
          title,
          payload: options.onItem(title),
        })),
    );
    return {
      text: ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
        instituteName: this.scheduleService.instituteNameByHash(instituteHash),
        currentPage,
        totalPages,
      }),
      keyboard: this.keyboardFactory.getPagination({
        currentPage,
        totalPages,
        items: rows,
        getPagePayload: (nextPage) => options.onPage(instituteHash, nextPage),
        additionalButtons: options.additionalButtons || [],
        pagerMode: 'compact',
      }),
    };
  }
}
