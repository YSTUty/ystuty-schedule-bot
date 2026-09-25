import { Injectable } from '@nestjs/common';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

import { ScheduleService } from '../../../schedule/schedule.service';
import {
  VKKeyboardFactory,
  VKPaginationOptions,
} from '../../vk-keyboard.factory';

type VkPickerButtons = VKPaginationOptions['additionalButtons'];

type VkPickerOptions = {
  onItem: (value: string) => Record<string, unknown>;
  onPage: (hash: string | undefined, page: number) => Record<string, unknown>;
  additionalButtons?: VkPickerButtons;
  pagerMode?: VKPaginationOptions['pagerMode'];
  /** Число групп в строке. Выбор зависит от button budget конкретного экрана. */
  groupColumns?: number;
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
        pagerMode: options.pagerMode || 'compact',
      }),
    };
  }

  public renderGroups(
    ctx: IContext,
    instituteHash: string | null,
    page: number,
    options: VkPickerOptions,
    count = 4,
  ) {
    const { items, currentPage, totalPages } = this.scheduleService.groupsList(
      page,
      count,
      instituteHash,
    );
    const groupColumns = options.groupColumns || 2;
    const rows = Array.from(
      { length: Math.ceil(items.length / groupColumns) },
      (_, index) =>
        items
          .slice(index * groupColumns, (index + 1) * groupColumns)
          .map((title) => ({
            title,
            payload: options.onItem(title),
          })),
    );
    return {
      text: ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
        instituteName: instituteHash
          ? this.scheduleService.instituteNameByHash(instituteHash)
          : undefined,
        currentPage,
        totalPages,
      }),
      keyboard: this.keyboardFactory.getPagination({
        currentPage,
        totalPages,
        items: rows,
        getPagePayload: (nextPage) =>
          options.onPage(instituteHash || undefined, nextPage),
        additionalButtons: options.additionalButtons || [],
        pagerMode: options.pagerMode || 'compact',
      }),
    };
  }
}
