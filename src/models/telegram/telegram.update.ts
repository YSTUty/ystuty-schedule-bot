import { Logger, UseFilters } from '@nestjs/common';
import { Action, Command, Ctx, Update, On } from '@xtcry/nestjs-telegraf';
import { TelegramError } from 'telegraf';
import * as tg from 'telegraf/typings/core/types/typegram';
import { patternGroupName, TelegrafExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IContext, IMessageContext } from '@my-interfaces/telegram';

import { YSTUtyService } from '../ystuty/ystuty.service';
import { TelegramService } from './telegram.service';

import { TgHearsLocale } from './decorators/tg-hears-locale.decorator';
import { TelegramKeyboardFactory } from './telegram-keyboard.factory';
import { SELECT_GROUP_SCENE } from './telegram.constants';

@Update()
@UseFilters(TelegrafExceptionFilter)
export class StartTelegramUpdate {
    private readonly logger = new Logger(StartTelegramUpdate.name);

    constructor(
        private readonly keyboardFactory: TelegramKeyboardFactory,
        private readonly ystutyService: YSTUtyService,
        private readonly telegramService: TelegramService,
    ) {}

    @TgHearsLocale(LocalePhrase.Button_Cancel)
    @TgHearsLocale(LocalePhrase.RegExp_Start)
    hearStart(@Ctx() ctx: IMessageContext) {
        if (ctx.chat.type !== 'private' && !ctx.state.appeal) {
            return;
        }


        if (ctx.chat.type === 'private' && !ctx.session.selectedGroupName) {
            const keyboard = this.keyboardFactory.getSelectGroupInline(ctx);
            ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_InitBot), keyboard);
            return;
        }

        const keyboard = this.keyboardFactory.getStart(ctx);
        ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Start), keyboard);
    }

    @TgHearsLocale(LocalePhrase.RegExp_Help)
    hearHelp(@Ctx() ctx: IMessageContext) {
        if (ctx.chat.type !== 'private' && !ctx.state.appeal) {
            return;
        }

        const keyboard = this.keyboardFactory.getStart(ctx);
        ctx.replyWithHTML(ctx.i18n.t(LocalePhrase.Page_Help), keyboard);
    }

    @On('my_chat_member')
    async onMyChatMember(
        @Ctx() ctx: IContext<{}, tg.Update.MyChatMemberUpdate>,
    ) {
        const {
            chat,
            new_chat_member: { status },
        } = ctx.myChatMember;
        if (chat.type === 'private') return;

        this.logger.log(`New bot status: "${status}"`);

        const { title } = chat;
        if (status === 'member') {
            const keyboard = this.keyboardFactory.getStart(ctx);
            await ctx.replyWithHTML(
                ctx.i18n.t(LocalePhrase.Page_Start),
                keyboard,
            );
            this.telegramService.parseChatTitle(ctx, title);
            if (!ctx.sessionConversation.selectedGroupName) {
                const keyboard = this.keyboardFactory.getSelectGroupInline(ctx);
                ctx.replyWithHTML(
                    ctx.i18n.t(LocalePhrase.Page_InitBot),
                    keyboard,
                );
            }
        } else if (status === 'left') {
            // TODO: remove all setting ?
        }
    }

    @On('new_chat_title')
    onNewChatTitle(@Ctx() ctx: IMessageContext) {
        if ('new_chat_title' in ctx.message) {
            this.telegramService.parseChatTitle(
                ctx,
                ctx.message.new_chat_title,
            );
        }
    }

    @Action(LocalePhrase.Button_SelectGroup)
    async onSelectGroup(@Ctx() ctx: IMessageContext) {
        ctx.scene.enter(SELECT_GROUP_SCENE);
        ctx.answerCbQuery();
    }

    @Command('tt')
    @Command('day')
    @TgHearsLocale([
        LocalePhrase.RegExp_Schedule_For_OneDay,
        LocalePhrase.Button_Schedule_Schedule,
        LocalePhrase.Button_Schedule_ForToday,
        LocalePhrase.Button_Schedule_ForTomorrow,
    ])
    @Action(
        [
            LocalePhrase.Button_Schedule_Schedule,
            LocalePhrase.Button_Schedule_ForToday,
            LocalePhrase.Button_Schedule_ForTomorrow,
        ].map(
            (e) =>
                new RegExp(
                    `(?<phrase>${e.replace('.', '\\.')}):?${patternGroupName}?`,
                    'i',
                ),
        ),
    )
    async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
        const session =
            ctx.chat.type === 'private' ? ctx.session : ctx.sessionConversation;

        const groupNameFromMath = ctx.match?.groups?.groupName;
        const groupName = this.ystutyService.getGroupByName(
            groupNameFromMath || session.selectedGroupName,
        );

        const _skipDays = ctx.match?.groups?.skipDays ?? null;
        let skipDays = Number(_skipDays) || 0;
        const isTomorrow =
            !!ctx.match?.groups?.tomorrow ||
            ctx.match?.groups?.phrase ===
                LocalePhrase.Button_Schedule_ForTomorrow;

        if (!groupName) {
            if (session.selectedGroupName) {
                ctx.replyWithHTML(
                    ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
                        groupName: groupNameFromMath,
                    }),
                );
                return;
            }
            ctx.scene.enter(SELECT_GROUP_SCENE);
            return;
        }

        if (!ctx.callbackQuery) {
            ctx.replyWithChatAction('typing');
        }

        let message: string | false;
        let days: number;
        if (isTomorrow) {
            skipDays = 1;
            [days, message] = await this.ystutyService.findNext({
                skipDays,
                groupName,
            });
        } else if (_skipDays !== null) {
            message = await this.ystutyService.getFormatedSchedule({
                skipDays,
                groupName,
            });
        } else {
            [days, message] = await this.ystutyService.findNext({
                groupName,
            });
        }

        if (message && days - 1 > skipDays) {
            message = ctx.i18n.t(LocalePhrase.Page_Schedule_NearestSchedule, {
                days,
                content: message,
            });
        }

        if (!message) {
            message = `${ctx.i18n.t(
                LocalePhrase.Page_Schedule_NotFoundToday,
            )}\n`;
        }

        const keyboard = this.keyboardFactory.getScheduleInline(ctx, groupName);
        const content = `${message}[${groupName}]`;

        if (ctx.callbackQuery) {
            try {
                ctx.editMessageText(content, {
                    ...keyboard,
                    parse_mode: 'HTML',
                });
            } catch {}
            ctx.answerCbQuery();
        } else {
            ctx.replyWithHTML(content, keyboard);
        }
    }

    @Command('week')
    @TgHearsLocale([
        LocalePhrase.RegExp_Schedule_For_Week,
        LocalePhrase.Button_Schedule_ForWeek,
        LocalePhrase.Button_Schedule_ForNextWeek,
    ])
    @Action(
        [
            LocalePhrase.Button_Schedule_ForWeek,
            LocalePhrase.Button_Schedule_ForNextWeek,
        ].map(
            (e) =>
                new RegExp(
                    `(?<phrase>${e.replace('.', '\\.')}):?${patternGroupName}?`,
                    'i',
                ),
        ),
    )
    async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
        const session =
            ctx.chat.type === 'private' ? ctx.session : ctx.sessionConversation;

        const groupNameFromMath = ctx.match?.groups?.groupName;
        const groupName = this.ystutyService.getGroupByName(
            groupNameFromMath || session.selectedGroupName,
        );

        const isNextWeek =
            !!ctx.match?.groups?.next ||
            ctx.match?.groups?.phrase ===
                LocalePhrase.Button_Schedule_ForNextWeek;
        let skipDays = isNextWeek ? 7 + 1 : 1;

        if (!groupName) {
            if (session.selectedGroupName) {
                ctx.replyWithHTML(
                    ctx.i18n.t(LocalePhrase.Page_SelectGroup_NotFound, {
                        groupName: groupNameFromMath,
                    }),
                );
                return;
            }
            ctx.scene.enter(SELECT_GROUP_SCENE);
            return;
        }

        if (!ctx.callbackQuery) {
            ctx.replyWithChatAction('typing');
        }

        let [days, message] = await this.ystutyService.findNext({
            skipDays,
            groupName,
            isWeek: true,
        });

        if (message) {
            if (days - 1 > skipDays) {
                message = ctx.i18n.t(
                    LocalePhrase.Page_Schedule_NearestSchedule,
                    { days, content: message },
                );
            }

            message = `Расписание на ${
                isNextWeek ? 'следющую ' : ''
            }неделю:\n${message}`;
        } else {
            message = `${ctx.i18n.t(
                LocalePhrase.Page_Schedule_NotFoundToday,
            )}\n`;
        }

        const keyboard = this.keyboardFactory.getScheduleInline(ctx, groupName);
        const content = `${message}[${groupName}]`;

        if (ctx.callbackQuery) {
            try {
                ctx.editMessageText(content, {
                    ...keyboard,
                    parse_mode: 'HTML',
                });
            } catch {}
            ctx.answerCbQuery();
        } else {
            ctx.replyWithHTML(content, keyboard);
        }
    }

    @TgHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
    async hearSelectGroup(@Ctx() ctx: IMessageContext) {
        const { from, chat, state } = ctx;
        const groupName = ctx.match?.groups?.groupName;
        const withTrigger = !!ctx.match?.groups?.trigger;

        if (chat.type !== 'private') {
            if (!withTrigger && !state.appeal) {
                return;
            }

            try {
                const members = await ctx.telegram.getChatAdministrators(
                    chat.id,
                );

                if (
                    !['administrator', 'creator'].includes(
                        members.find((e) => e.user.id === from.id)?.status,
                    )
                ) {
                    return ctx.i18n.t(LocalePhrase.Common_NoAccess);
                }
            } catch (err) {
                if (err instanceof TelegramError) {
                    // if (error.code === 917) {
                    //     return ctx.i18n.t(LocalePhrase.Common_NoAccess);
                    // }
                    console.error(err);
                    return ctx.i18n.t(LocalePhrase.Common_Error);
                }
                throw err;
            }
        }

        ctx.scene.enter(SELECT_GROUP_SCENE, { groupName });
    }
}
