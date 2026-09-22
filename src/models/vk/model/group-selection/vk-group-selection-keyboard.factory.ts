import { Injectable } from '@nestjs/common';

import { Keyboard } from 'vk-io';

import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

/** Клавиатуры transport-сценария выбора учебной группы. */
@Injectable()
export class VkGroupSelectionKeyboardFactory {
  /** Клавиатура сцены выбора группы: ввод вручную или переход к институтам. */
  public getSelectGroupScene(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Groups_ListInstAndGroups),
          payload: { groupAction: 'institutes' },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { phrase: LocalePhrase.Button_Cancel },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  /** Кнопка возврата из списка групп к списку институтов. */
  public getInstitutesListButton(
    ctx: IContext,
    payload: Record<string, unknown> = { groupAction: 'institutes' },
  ) {
    return Keyboard.callbackButton({
      label: ctx.i18n.t(LocalePhrase.Button_Groups_ChangeInstitute),
      payload,
      color: Keyboard.PRIMARY_COLOR,
    });
  }

  public getSelectGroup(ctx: IContext, groupName?: string) {
    return Keyboard.keyboard([
      [
        groupName
          ? Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_SelectGroup_X, {
                groupName,
              }),
              payload: { phrase: LocalePhrase.Button_SelectGroup, groupName },
              color: Keyboard.POSITIVE_COLOR,
            })
          : Keyboard.callbackButton({
              label: ctx.i18n.t(LocalePhrase.Button_SelectGroup),
              payload: { phrase: LocalePhrase.Button_SelectGroup },
              color: Keyboard.POSITIVE_COLOR,
            }),
      ],
    ]);
  }
}
