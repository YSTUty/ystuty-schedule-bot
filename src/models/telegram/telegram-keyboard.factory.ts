import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

@Injectable()
export class TelegramKeyboardFactory {
    public getStart(ctx: IContext) {
        return Markup.keyboard([
            [ctx.i18n.t(LocalePhrase.Button_Schedule_Schedule)],
        ]).resize();
    }

    public getSelectGroupInline(ctx: IContext) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(
                    ctx.i18n.t(LocalePhrase.Button_SelectGroup),
                    LocalePhrase.Button_SelectGroup,
                ),
            ],
        ]);
    }

    public getScheduleInline(ctx: IContext, groupName: string = '') {
        const makeButton = (phrase: LocalePhrase) =>
            Markup.button.callback(
                ctx.i18n.t(phrase),
                groupName ? `${phrase}:${groupName}` : phrase,
            );

        return Markup.inlineKeyboard([
            [
                makeButton(LocalePhrase.Button_Schedule_ForToday),
                makeButton(LocalePhrase.Button_Schedule_ForTomorrow),
            ],
            [
                makeButton(LocalePhrase.Button_Schedule_ForWeek),
                makeButton(LocalePhrase.Button_Schedule_ForNextWeek),
            ],
        ]);
    }

    public getCancel(ctx: IContext) {
        return {
            ...Markup.keyboard([
                [ctx.i18n.t(LocalePhrase.Button_Cancel)],
            ]).resize(),
        };
    }

    public getCancelInline(ctx: IContext) {
        return {
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback(
                        ctx.i18n.t(LocalePhrase.Button_Cancel),
                        LocalePhrase.Button_Cancel,
                    ),
                ],
            ]),
        };
    }

    public getICalendarInline(ctx: IContext, link: string, title: string) {
        return {
            ...Markup.inlineKeyboard([[Markup.button.url(title, link)]]),
        };
    }
}
