import { Logger, UseFilters } from '@nestjs/common';
import { InjectVkApi, Update, Ctx, HearFallback } from 'nestjs-vk';
import { VK, APIError } from 'vk-io';
import { VkExceptionFilter } from '@my-common';
import { LocalePhrase } from '@my-interfaces';
import { IMessageContext } from '@my-interfaces/vk';

import { YSTUtyService } from '../ystuty/ystuty.service';

import { VkHearsLocale } from './decorators/vk-hears-locale.decorator';
import { VkService } from './vk.service';
import { VKKeyboardFactory } from './vk-keyboard.factory';
import { SELECT_GROUP_SCENE } from './vk.constants';

@Update()
@UseFilters(VkExceptionFilter)
export class VkUpdate {
    private readonly logger = new Logger(VkUpdate.name);

    constructor(
        @InjectVkApi()
        private readonly vk: VK,
        private readonly vkService: VkService,
        private readonly ystutyService: YSTUtyService,
        private readonly keyboardFactory: VKKeyboardFactory,
    ) {}

    @VkHearsLocale(LocalePhrase.RegExp_Start)
    async hearStart(@Ctx() ctx: IMessageContext) {
        if (ctx.isChat && !ctx.state.appeal) {
            return;
        }

        const keyboard = this.keyboardFactory.getStart(ctx);
        ctx.send(ctx.i18n.t(LocalePhrase.Page_Start), { keyboard });
    }

    @VkHearsLocale([
        LocalePhrase.RegExp_Schedule_For_OneDay,
        LocalePhrase.Button_Schedule_Schedule,
        LocalePhrase.Button_Schedule_ForToday,
        LocalePhrase.Button_Schedule_ForTomorrow,
    ])
    async hearSchedul_OneDay(@Ctx() ctx: IMessageContext) {
        const session = !ctx.isChat ? ctx.session : ctx.sessionConversation;

        const groupName = this.ystutyService.getGroupByName(
            ctx.$match?.groups?.groupName ||
                ctx.messagePayload?.groupName ||
                session.selectedGroupName,
        );

        const _skipDays = ctx.$match?.groups?.skipDays ?? null;
        let skipDays = Number(_skipDays) || 0;
        const isTomorrow =
            !!ctx.$match?.groups?.tomorrow ||
            ctx.messagePayload?.phrase ===
                LocalePhrase.Button_Schedule_ForTomorrow;

        if (!groupName) {
            ctx.scene.enter(SELECT_GROUP_SCENE);
            return;
        }

        ctx.setActivity();

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
            message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
        }

        const keyboard = this.keyboardFactory
            .getSchedule(ctx, groupName)
            .inline(true);
        ctx.send(`${message}\n[${groupName}]`, { keyboard });
    }

    @VkHearsLocale([
        LocalePhrase.RegExp_Schedule_For_Week,
        LocalePhrase.Button_Schedule_ForWeek,
        LocalePhrase.Button_Schedule_ForNextWeek,
    ])
    async hearSchedul_Week(@Ctx() ctx: IMessageContext) {
        const session = !ctx.isChat ? ctx.session : ctx.sessionConversation;

        const groupName = this.ystutyService.getGroupByName(
            ctx.$match?.groups?.groupName ||
                ctx.messagePayload?.groupName ||
                session.selectedGroupName,
        );

        const isNextWeek =
            !!ctx.$match?.groups?.next ||
            ctx.messagePayload?.phrase ===
                LocalePhrase.Button_Schedule_ForNextWeek;
        let skipDays = isNextWeek ? 7 + 1 : 1;

        if (!groupName) {
            ctx.scene.enter(SELECT_GROUP_SCENE);
            return;
        }

        ctx.setActivity();

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
            message = ctx.i18n.t(LocalePhrase.Page_Schedule_NotFoundToday);
        }

        const keyboard = this.keyboardFactory
            .getSchedule(ctx, groupName)
            .inline(true);
        ctx.send(`${message}\n[${groupName}]`, { keyboard });
    }

    @VkHearsLocale(LocalePhrase.RegExp_Schedule_SelectGroup)
    async hearSelectGroup(@Ctx() ctx: IMessageContext) {
        const { senderId, peerId, state } = ctx;
        const groupName = ctx.$match?.groups?.groupName;
        const withTrigger = !!ctx.$match?.groups?.trigger;

        if (ctx.isChat) {
            if (!withTrigger && !state.appeal) {
                return;
            }

            try {
                const { items } =
                    await this.vk.api.messages.getConversationMembers({
                        peer_id: peerId,
                    });
                if (!items.find((e) => e.member_id === senderId).is_admin) {
                    return ctx.i18n.t(LocalePhrase.Common_NoAccess);
                }
            } catch (error) {
                if (error instanceof APIError) {
                    if (error.code === 917) {
                        return ctx.i18n.t(LocalePhrase.Common_NoAccess);
                    }
                    // return ctx.i18n.t(LocalePhrase.Common_Error);
                }
                throw error;
            }
        }

        ctx.scene.enter(SELECT_GROUP_SCENE, { state: { groupName } });
    }

    @HearFallback()
    async onHearFallback(@Ctx() ctx: IMessageContext) {
        // ...
    }
}
