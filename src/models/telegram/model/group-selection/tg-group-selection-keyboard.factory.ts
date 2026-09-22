import { Injectable } from '@nestjs/common';

import { md5 } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import {
  TelegramMarkup as Markup,
  TelegramButtons,
} from '../../telegram-buttons.util';

/** Клавиатуры transport-сценария выбора учебной группы. */
@Injectable()
export class TgGroupSelectionKeyboardFactory {
  public getSelectGroupInline(ctx: IContext, groupName?: string) {
    return Markup.inlineKeyboard([
      [
        groupName
          ? TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup_X, { groupName }),
              `selectGroup:${md5(groupName).slice(0, 12)}`,
              { style: 'primary' },
            )
          : TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_SelectGroup),
              LocalePhrase.Button_SelectGroup,
              { style: 'primary' },
            ),
      ],
    ]);
  }

  /** Экран ручного выбора группы для callback и обычного сообщения. */
  public getSelectGroupPrompt(
    ctx: IContext,
    inline: true,
  ): ReturnType<typeof Markup.inlineKeyboard>;
  public getSelectGroupPrompt(
    ctx: IContext,
    inline: false,
  ): ReturnType<typeof Markup.keyboard>;
  public getSelectGroupPrompt(ctx: IContext, inline: boolean) {
    return inline
      ? Markup.inlineKeyboard([
          [
            TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              'pager:inst-list',
              { style: 'primary' },
            ),
          ],
          [
            TelegramButtons.callback(
              ctx.i18n.t(LocalePhrase.Button_Cancel),
              LocalePhrase.Button_Cancel,
              { style: 'danger' },
            ),
          ],
        ])
      : Markup.keyboard([
          [
            TelegramButtons.text(ctx.i18n.t(LocalePhrase.Button_Cancel), {
              style: 'danger',
            }),
          ],
          [
            TelegramButtons.text(
              ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
              { style: 'primary' },
            ),
          ],
        ]).resize();
  }

  /** Кнопка перехода к общему списку групп со страницы институтов. */
  public getAllGroupsListButton(ctx: IContext) {
    return TelegramButtons.callback(
      ctx.i18n.t(LocalePhrase.Button_Groups_ListGroups),
      'pager:glist',
      { style: 'primary' },
    );
  }

  /** Кнопка возврата из списка групп к списку институтов. */
  public getInstitutesListButton(ctx: IContext) {
    return Markup.button.callback(
      ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
      'pager:inst-list',
    );
  }
}
