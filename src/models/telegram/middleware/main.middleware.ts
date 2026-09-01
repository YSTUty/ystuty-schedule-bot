import { Injectable, Logger } from '@nestjs/common';

import * as tg from 'telegraf-hardened/types';
import { TelegramError } from 'telegraf-hardened';
import { Context } from 'telegraf-hardened';
import { MiddlewareObj } from 'telegraf-hardened';
import { FmtString } from 'telegraf-hardened/format';

import * as xEnv from '@my-environment';
import { SOCIAL_TELEGRAM_BOT_NAME } from '@my-environment';

import { isConcurrencyControlError } from '@my-common/exception';
import {
  allowerHtmlTags,
  findSmartStreamPositions,
  normalizePartialHtml,
  normalizePartialMarkdown,
  normalizePartialMarkdownV2,
} from '@my-common/util/text.util';
import { i18n } from '@my-common/util/tg';
import { LocalePhrase } from '@my-interfaces';
import { IContext } from '@my-interfaces/telegram';

import { ConcurrencyService } from '../../concurrency/concurrency.service';
import { DebounceRegistryService } from '../../concurrency/debounce-registry.service';

@Injectable()
export class MainMiddleware implements MiddlewareObj<IContext> {
  private static readonly COOLDOWN_MESSAGE_DEBOUNCE_MS = 3e3;

  private readonly logger = new Logger(MainMiddleware.name);

  constructor(
    private readonly concurrencyService: ConcurrencyService,
    private readonly debounceRegistryService: DebounceRegistryService,
  ) {}

  public get middlewareForkAll() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      // Нам важно не блокировать обработку других апдейтов одним долгим запросом,
      // поэтому цепочка запускается в фоне. Ошибки detached-ветки нужно поглощать
      // локально, иначе они могут дойти до unhandled rejection и уронить процесс.
      void Promise.resolve()
        .then(() => next())
        .catch((err: unknown) => {
          if (err instanceof Error) {
            this.logger.error('[middlewareForkAll] Error', err.stack);
            return;
          }

          this.logger.error(`[middlewareForkAll] Error: ${String(err)}`);
        });
    };
  }

  public middleware() {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      // console.log('[ctx update]', { updateType: ctx.updateType }, ctx.update);

      if (
        !ctx.from ||
        (ctx.from.is_bot &&
          // Allow this bot for get updates of invite to channel
          ctx.from.username &&
          ctx.from.username.toLowerCase() !== 'Channel_Bot'.toLowerCase())
      ) {
        if (
          ctx.updateType === 'message_reaction' ||
          ctx.updateType === 'message_reaction_count'
        ) {
          this.logger.debug('[MessageReactions]');
          this.logger.debug(
            JSON.stringify({
              chat: ctx.chat,
              reactions: (
                ctx.update['message_reaction'] ||
                ctx.update['message_reaction_count']
              )?.reactions,
            }),
          );
        }
        // TODO: remove after test
        else if (!ctx.from) {
          this.logger.warn(
            `Empty ctx.from from ctx on updateType(${ctx.updateType})`,
          );
          this.logger.debug(JSON.stringify(ctx.update));
        }
        return;
      }

      if (ctx.updateType === 'channel_post' || ctx.from!.is_bot) {
        return;
      }

      ctx.tryAnswerCbQuery = async (...args) => {
        if (ctx.updateType !== 'callback_query') {
          return null;
        }

        try {
          return await ctx.answerCbQuery(...args);
        } catch (err) {
          if (
            err instanceof TelegramError &&
            err.code === 400 &&
            err.description.includes('query is too old')
          ) {
            // Callback уже истёк: пользователь мог получить результат через edit/reply.
            return null;
          }
          throw err;
        }
      };

      ctx.sendMessage = async (
        text: string | FmtString,
        extra?: Omit<tg.Opts<'sendMessage'>, 'chat_id' | 'text'>,
      ) => {
        ctx.assert(ctx.chat, 'sendMessage');
        const result = await ctx.telegram.sendMessage(ctx.chat!.id, text, {
          message_thread_id: getThreadId(ctx),
          ...extra,
        });

        // if (result.message_id) {
        //   ctx.session.lastMessage = {
        //     id: result.message_id,
        //     time: result.date,
        //   };
        // }
        return result;
      };

      ctx.sendMessageDraft = async (
        draft_id: number,
        text: string | FmtString,
        extra?,
      ): Promise<boolean> => {
        ctx.assert(ctx.chat, 'sendMessage');
        return ctx.telegram.sendMessageDraft({
          chat_id: ctx.chat!.id,
          draft_id,
          ...extra,
          // Повторяем нормализацию Telegram.sendMessage: FmtString передаёт
          // форматирование через entities, а не как объект в поле text.
          ...FmtString.normalise(text),
        });
      };

      ctx.sendStreamingMessage = async (text, options) => {
        const parse_mode = options?.parse_mode;
        const delay = Math.max(220, options?.chunkDelay ?? 550);
        const gap = Math.max(20, options?.gap ?? 120);
        const htmlAware = options?.htmlAwareSplit ?? parse_mode === 'HTML';
        const draftId =
          (Date.now() % 1_000e9) + Math.floor(Math.random() * 1e3);

        const streamSource =
          parse_mode === 'HTML' ? text : allowerHtmlTags(text, '');
        const positions = findSmartStreamPositions(streamSource, gap, {
          htmlAware,
          minGap: Math.floor(gap * 0.6),
        });
        // console.log('positions', positions);
        // console.log(
        //   'parts',
        //   positions.map((pos) =>
        //     normalizePartialHtml(streamSource.slice(0, pos)),
        //   ),
        // );

        if (!positions.length) {
          return ctx.sendMessage(text, {
            parse_mode,
            ...(options?.replyToMessageId && {
              reply_parameters: {
                message_id: options.replyToMessageId,
                allow_sending_without_reply: true,
              },
            }),
          });
        }

        // Stream drafts as plain text
        for (const pos of positions) {
          const rawPartial = streamSource.slice(0, pos);
          const partial =
            parse_mode === 'HTML'
              ? normalizePartialHtml(rawPartial)
              : parse_mode === 'MarkdownV2'
                ? normalizePartialMarkdownV2(rawPartial)
                : parse_mode === 'Markdown'
                  ? normalizePartialMarkdown(rawPartial)
                  : rawPartial;

          let ok = false;
          try {
            await ctx.sendMessageDraft(draftId, partial, { parse_mode });
            ok = true;
          } catch (err) {
            if (err instanceof TelegramError) {
              this.logger.warn('[sendMessageDraft] TelegramError');
              this.logger.debug(JSON.stringify(err.response));
            }
            if (err instanceof TelegramError && err.code === 429) {
              const retryAfter: number = err.parameters?.retry_after ?? 5;
              await new Promise((r) => setTimeout(r, retryAfter * 1e3));
              try {
                await ctx.sendMessageDraft(draftId, partial, { parse_mode });
                ok = true;
              } catch {}
            }
          }
          // console.log(
          //   ` → Send at pos ${String(pos).padStart(4, '0')} `,
          //   new Date().toISOString(),
          // );

          if (!ok) {
            this.logger.warn(
              `Draft streaming failed at pos ${pos}, falling back to sendMessage`,
            );
            return ctx.sendMessage(text, {
              parse_mode,
              ...(options?.replyToMessageId && {
                reply_parameters: {
                  message_id: options.replyToMessageId,
                  allow_sending_without_reply: true,
                },
              }),
            });
          }

          await new Promise((r) => setTimeout(r, delay));
        }

        // console.log(`Done streaming`);
        // Final sendMessage persists the full text with formatting (replaces ephemeral draft)
        return ctx.sendMessage(text, {
          parse_mode,
          ...(options?.replyToMessageId && {
            reply_parameters: {
              message_id: options.replyToMessageId,
              allow_sending_without_reply: true,
            },
          }),
        });
      };

      this.checkInGroupAppeal(ctx);

      const telegramId = ctx.from.id;
      this.concurrencyService
        .exclusiveLocal(
          this.concurrencyService.buildKey('mw:update:tg', telegramId),
          async () => await next?.(),
          { timeoutMs: 2e3 },
        )
        .catch(async (err: unknown) => {
          if (await this.handleConcurrencyControlError(ctx, err)) {
            return;
          }

          if (err instanceof Error) {
            this.logger.error('[middleware] Error', err.stack);
            return;
          }
          this.logger.error(`[middleware] Error: ${String(err)}`);
        });
    };
  }

  public middlewareCleaner(after = false) {
    return async (ctx: IContext, next: (...args: any[]) => Promise<any>) => {
      if (!after) {
        this.cleanSession(ctx, true);
      }
      const res = await next?.();
      this.cleanSession(ctx);
      return res;
    };
  }

  private checkInGroupAppeal(ctx: IContext) {
    if (!('message' in ctx.update)) return;
    const {
      update: { message },
    } = ctx;
    ctx.state.appeal = false;

    if (
      'reply_to_message' in message &&
      message.reply_to_message?.from?.id === ctx.botInfo.id
    ) {
      ctx.state.appeal = true;
    }

    if (!('text' in message)) return;

    const triggerRegexp = new RegExp(
      // `^@${SOCIAL_TELEGRAM_BOT_NAME},? `,
      `^.*(@${SOCIAL_TELEGRAM_BOT_NAME})$`,
      'i',
    );

    if (triggerRegexp.test(message.text)) {
      const triggerMsg = message.text.match(triggerRegexp)!;
      // message.text = message.text.slice(triggerMsg[0].length);
      message.text = message.text.slice(0, -triggerMsg[1].length);
      ctx.state.appeal = true;
    }
  }

  private cleanSession(ctx: IContext, revert = false) {
    const { session } = ctx;
    if (!session) return;

    // Scene
    if (revert) {
      // ? why?
      // session['__scenes'] = {};
    } else if (
      session['__scenes'] &&
      Object.keys(session['__scenes']).length === 0
    ) {
      delete session['__scenes'];
    }

    // i18n
    if (session['__language_code'] === 'ru') {
      delete session['__language_code'];
    }
  }

  private async handleConcurrencyControlError(
    ctx: IContext,
    error: unknown,
  ): Promise<boolean> {
    if (!isConcurrencyControlError(error)) {
      return false;
    }

    const isAdmin =
      ctx.from && xEnv.SOCIAL_TELEGRAM_ADMIN_IDS.includes(ctx.from.id);
    const content =
      ctx.i18n?.t(LocalePhrase.Common_Cooldown) || LocalePhrase.Common_Cooldown;

    try {
      if (await ctx.tryAnswerCbQuery?.(content, { show_alert: isAdmin })) {
        return true;
      }

      const debounceKey = this.debounceRegistryService.buildKey(
        ['tg', 'cooldown'],
        ctx.from?.id,
      );
      if (
        this.debounceRegistryService.checkAndMark(
          debounceKey,
          MainMiddleware.COOLDOWN_MESSAGE_DEBOUNCE_MS,
        )
      ) {
        await ctx.replyWithHTML(content, {
          ...(ctx.message?.message_id && {
            reply_parameters: {
              message_id: ctx.message.message_id,
              allow_sending_without_reply: true,
            },
          }),
        });
      }
    } catch {}

    return true;
  }

  // ?? зачем этот метод, если можно юзать `import { i18n } from '@my-common/util/tg';`
  public get i18nMiddleware() {
    return async (ctx: IContext, next: () => Promise<unknown>) => {
      const session: IContext['session'] =
        i18n.config.useSession && ctx[i18n.config.sessionName];
      const languageCode =
        session?.__language_code ??
        ctx.from?.language_code ??
        i18n.config.defaultLanguage;

      ctx.i18n = i18n.createContext(languageCode, {
        // * Put `ctx`
        ctx,
        from: ctx.from,
        chat: ctx.chat,
      }) as any;

      await next();

      if (session) {
        session.__language_code = ctx.i18n.locale();
      }
    };
  }
}

const getThreadId = <U extends tg.Update>(ctx: Context<U>) => {
  const msg = ctx.msg;
  return msg?.isAccessible()
    ? msg.is_topic_message
      ? msg.message_thread_id
      : undefined
    : undefined;
};

/**
 * Find natural breakpoints in text for progressive streaming via sendMessageDraft.
 * Returns character positions where the text can be sliced (text.slice(0, pos)).
 * Breakpoints are at line breaks and sentence endings, with minimum gap to avoid flicker.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- helper reserved for streaming drafts.
function findStreamPositions(text: string, minGap = 30): number[] {
  const positions: number[] = [];
  let lastPos = 0;

  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    const next = text[i + 1];
    const isLineBreak = ch === '\n';
    const isSentenceEnd =
      (ch === '.' ||
        ch === '!' ||
        ch === '?' ||
        ch === '。' ||
        ch === '！' ||
        ch === '？') &&
      (next === ' ' || next === '\n');

    if ((isLineBreak || isSentenceEnd) && i + 1 - lastPos >= minGap) {
      positions.push(i + 1);
      lastPos = i + 1;
    }
  }

  return positions;
}
