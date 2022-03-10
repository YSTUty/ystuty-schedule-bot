import { Injectable } from '@nestjs/common';
import { Keyboard } from 'vk-io';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

@Injectable()
export class VKKeyboardFactory {
    public getStart(ctx: IMessageContext) {
        return Keyboard.keyboard([
            [
                Keyboard.textButton({
                    label: ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule),
                    payload: { phrase: LocalePhrase.Button_Schedule_Schedule },
                    color: Keyboard.SECONDARY_COLOR,
                }),
            ],
        ]);
    }

    public getSchedule(ctx: IMessageContext, groupName?: string) {
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

    public getCancel(ctx: IMessageContext) {
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

    public getClose(ctx?: IMessageContext) {
        return Keyboard.keyboard([]).oneTime();
    }
}
