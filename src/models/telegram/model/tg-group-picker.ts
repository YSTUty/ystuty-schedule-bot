import { Injectable } from '@nestjs/common';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { ScheduleService } from '../../schedule/schedule.service';
import {
  TelegramKeyboardFactory,
  TelegramPaginationOptions,
} from '../telegram-keyboard.factory';

type TgPickerButtons = TelegramPaginationOptions['additionalButtons'];

type TgPickerOptions = {
  prefix: string;
  pagerName: string | ((hash: string) => string);
  onItem: (hash: string) => string;
  additionalButtons?: TgPickerButtons;
};

/** Рендерит переиспользуемые TG-списки институтов и групп через pagination factory. */
@Injectable()
export class TgGroupPicker {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly keyboardFactory: TelegramKeyboardFactory,
  ) {}

  public renderInstitutes(
    ctx: IContext,
    page: number,
    options: TgPickerOptions,
    count = 10,
  ) {
    const { items, currentPage, totalPages } =
      this.scheduleService.groupsInstitutesList(page, count);
    return {
      text: ctx.i18n.t(LocalePhrase.Page_SelectGroup_InstitutesList, {
        currentPage,
        totalPages,
      }),
      keyboard: this.keyboardFactory.getPagination({
        name:
          typeof options.pagerName === 'function'
            ? options.pagerName('')
            : options.pagerName,
        currentPage,
        totalPages,
        items: items.map((title) => ({
          title,
          payload: options.onItem(md5(title).slice(0, 12)),
        })),
        actionPrefix: options.prefix,
        // Для короткого списка pager скрыт, чтобы не перегружать экран.
        additionalButtons: options.additionalButtons || [],
        columnizer: true,
        hidePager: totalPages <= 1,
      }),
    };
  }

  public renderGroups(
    ctx: IContext,
    instituteHash: string,
    page: number,
    options: TgPickerOptions,
    count = 26,
  ) {
    const { items, currentPage, totalPages } = this.scheduleService.groupsList(
      page,
      count,
      instituteHash,
    );
    return {
      text: ctx.i18n.t(LocalePhrase.Page_SelectGroup_GroupsList, {
        instituteName: this.scheduleService.instituteNameByHash(instituteHash),
        currentPage,
        totalPages,
      }),
      keyboard: this.keyboardFactory.getPagination({
        name:
          typeof options.pagerName === 'function'
            ? options.pagerName(instituteHash)
            : options.pagerName,
        currentPage,
        totalPages,
        items: items.map((title) => ({
          title,
          // Telegram callback_data ограничен 64 байтами, поэтому имя не передаём.
          payload: options.onItem(md5(title).slice(0, 12)),
        })),
        actionPrefix: options.prefix,
        additionalButtons: options.additionalButtons || [],
        columnizer: true,
        hidePager: totalPages <= 1,
      }),
    };
  }
}
