import { Injectable } from '@nestjs/common';
import { Keyboard } from 'vk-io';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/vk';

@Injectable()
export class VKKeyboardFactory {
  public needInline(ctx: IContext) {
    return ctx.isChat && ctx.sessionConversation.hideStaticKeyboard !== false;
  }

  public getStart(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
          payload: { phrase: LocalePhrase.Button_Schedule_Schedule },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
      [
        ...(ctx.isDM && ctx.state.user
          ? [
              Keyboard.textButton({
                label: ctx.i18n.t(LocalePhrase.Button_Profile),
                payload: { phrase: LocalePhrase.Button_Profile },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ]
          : []),
      ],
    ]);
  }

  public getAuth(
    ctx: IContext,
    social = true,
    addSelectGroup = false,
    addCancel = true,
  ) {
    const phrase = social
      ? LocalePhrase.Button_AuthLink_SocialConnect
      : LocalePhrase.Button_AuthLink;
    return Keyboard.keyboard([
      [
        Keyboard.callbackButton({
          label: ctx.i18n.t(phrase),
          color: Keyboard.SECONDARY_COLOR,
          payload: { phrase },
        }),
      ],
      ...(addSelectGroup
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                payload: { phrase: LocalePhrase.Button_SelectGroup },
                color: Keyboard.POSITIVE_COLOR,
              }),
            ],
          ]
        : []),
      ...(addCancel
        ? [
            [
              Keyboard.callbackButton({
                label: ctx.i18n.t(LocalePhrase.Button_Cancel),
                payload: { phrase: LocalePhrase.Button_Cancel },
                color: Keyboard.SECONDARY_COLOR,
              }),
            ],
          ]
        : []),
    ]);
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

  public getSchedule(ctx: IContext, groupName?: string) {
    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForToday),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForToday,
            groupName,
          },
          color: Keyboard.SECONDARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForTomorrow),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForTomorrow,
            groupName,
          },
          color: Keyboard.POSITIVE_COLOR,
        }),
      ],
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForWeek),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForWeek,
            groupName,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Schedule_ForNextWeek),
          payload: {
            phrase: LocalePhrase.Button_Schedule_ForNextWeek,
            groupName,
          },
          color: Keyboard.PRIMARY_COLOR,
        }),
      ],
    ]);
  }

  public getCancel(ctx: IContext) {
    return Keyboard.keyboard([
      [
        Keyboard.textButton({
          label: ctx.i18n.t(LocalePhrase.Button_Cancel),
          payload: { phrase: LocalePhrase.Button_Cancel },
          color: Keyboard.SECONDARY_COLOR,
        }),
      ],
    ]);
  }

  public getClose(ctx?: IContext) {
    return Keyboard.keyboard([]).oneTime();
  }
}
