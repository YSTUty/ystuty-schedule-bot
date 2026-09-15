import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';

import * as rxjs from 'rxjs';
import axios from 'axios';

import * as xEnv from '@my-environment';

import { SocialType } from '@my-common/constants';

import { UserService } from '../user/user.service';

type CheckAuthFailure = {
  signature: string;
  count: number;
  isOutputSuppressed: boolean;
};

@Injectable()
export class SocialConnectService {
  private static readonly CHECK_AUTH_ERROR_LOG_LIMIT = 2;

  private readonly logger = new Logger(SocialConnectService.name);

  private checkAuthProcess = 0;

  /** Состояние серии одинаковых ошибок polling-запроса к social-connect. */
  private checkAuthFailure?: CheckAuthFailure;

  private rateLimitter = new Map<string, number>();

  constructor(
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  public get isAvailable() {
    return !!xEnv.SOCAIL_CONNECT_URI;
  }

  public checkRate(socialType: SocialType, socialId: number) {
    const key = `${socialType}:${socialId}`;
    const time = this.rateLimitter.get(key);
    return !time || Date.now() - time > 10e3;
  }

  public makeRate(socialType: SocialType, socialId: number) {
    const key = `${socialType}:${socialId}`;
    const check = this.checkRate(socialType, socialId);
    if (!check) {
      return false;
    }
    this.rateLimitter.set(key, Date.now());
    return true;
  }

  public async requestAuth(socialType: SocialType, socialId: number) {
    const check = this.makeRate(socialType, socialId);
    if (!check) {
      return { error: 'rate limit' };
    }

    try {
      // * Создане запроса на разрешение авторизаци в этом сервисе
      const { data } = await rxjs.firstValueFrom(
        this.httpService.post<
          (
            | { status: 'auth' }
            | { status: 'unauth'; payload: string }
            | { status: 'process' }
          ) & { botName: string }
        >(`connect/auth/${socialType}`, {
          social_id: socialId,
          client_id: xEnv.OAUTH_CLIENT_ID,
          client_secret: xEnv.OAUTH_CLIENT_SECRET,
        }),
      );
      console.log('[requestAuth]', { data });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          const data = err.response.data as {
            error: { code: number; message: string; error: string };
          };
          this.logger.debug('[requestAuth] error', data);
          if ('error' in data && data.error.code === 404) {
            return { error: 'client not found' };
          }
        }
        this.logger.error('[requestAuth] Axios error', {
          code: err.code,
          message: err.message,
        });
      } else {
        this.logger.error('[requestAuth]', err);
      }
    }

    return { error: 'see log' };
  }

  public async unAuth(socialType: SocialType, socialId: number) {
    const check = this.makeRate(socialType, socialId);
    if (!check) {
      return { error: 'rate limit' };
    }

    try {
      // * Создане запроса на разрешение авторизаци в этом сервисе
      const { data } = await rxjs.firstValueFrom(
        this.httpService.post<boolean>(`connect/unauth/${socialType}`, {
          social_id: socialId,
          client_id: xEnv.OAUTH_CLIENT_ID,
          client_secret: xEnv.OAUTH_CLIENT_SECRET,
          // silent: true,
        }),
      );
      console.log('[unAuth]', { socialId, socialType, data });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          const data = err.response.data as {
            error: { code: number; message: string; error: string };
          };
          this.logger.debug('[unAuth] error', data);
          if ('error' in data && data.error.code === 404) {
            return { error: 'client not found' };
          }
        }
        this.logger.error('[unAuth] Axios error', {
          code: err.code,
          message: err.message,
        });
      } else {
        this.logger.error('[unAuth]', err);
      }
    }

    return false;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkAuth() {
    if (this.checkAuthProcess) {
      if (Date.now() - this.checkAuthProcess > 3600) {
        // TODO: alarm?
      }
      return;
    }
    this.checkAuthProcess = Date.now();

    // TODO: переделать на LongPoll?
    // TODO: делать запросы чуть реже, если сейчас не ждем никаких проверок.
    // ? Можно в сервисе в переменной хранить инфу - При первом запуске сделали проверку, и если результатов не было, то сбавляем интервал опросов.
    // ? Как только появился запрос от нашего севриса, то начинаем опрашивать чаще (и в переменную пометить, что сейчас ожидается +n ответов). После получения ответов делать -n.

    try {
      const { data } = await rxjs.firstValueFrom(
        this.httpService.post<{
          result: {
            socialType: SocialType;
            socialId: number;
            accessToken: string;
            refreshToken: string;
            status: 'confirm' | 'cancel';
          }[];
        }>(
          `connect/check`,
          {
            client_id: xEnv.OAUTH_CLIENT_ID,
            client_secret: xEnv.OAUTH_CLIENT_SECRET,
          },
          { timeout: 15e3 },
        ),
      );

      this.logCheckAuthRecovery();

      if (!data.result || data.result.length === 0) {
        return;
      }

      // console.log('[checkAuth]', data);
      const { result } = data;
      for (const item of result) {
        try {
          const result = await this.userService.auth(
            item.socialType,
            item.socialId,
            item.status === 'confirm' && {
              access_token: item.accessToken,
              refresh_token: item.refreshToken,
            },
          );
          this.logger.log(
            `Auth [${item.socialType}](${item.socialId}): ${result}`,
          );
        } catch (err) {
          this.logger.error('[checkAuth] auth error', err);
        }
      }
    } catch (err) {
      if (this.logCheckAuthFailure(err)) {
        return;
      }
    } finally {
      this.checkAuthProcess = 0;
    }

    // Clear old rates
    for (const [key, time] of this.rateLimitter) {
      if (Date.now() - time > 15e3) {
        this.rateLimitter.delete(key);
      }
    }
  }

  /**
   * Логирует первые ошибки серии, а дальнейшие одинаковые ошибки временно
   * подавляет, чтобы недоступный сервис не засорял журнал каждые 10 секунд.
   *
   * @returns `true`, если ответ social-connect содержит собственное поле error.
   */
  private logCheckAuthFailure(err: unknown) {
    const { signature, hasResponseError } =
      this.getCheckAuthFailureDetails(err);
    if (this.checkAuthFailure?.signature !== signature) {
      this.checkAuthFailure = {
        signature,
        count: 0,
        isOutputSuppressed: false,
      };
    }

    const failure = this.checkAuthFailure;
    failure.count += 1;

    if (failure.count <= SocialConnectService.CHECK_AUTH_ERROR_LOG_LIMIT) {
      this.logCheckAuthError(err, hasResponseError);
    } else if (!failure.isOutputSuppressed) {
      failure.isOutputSuppressed = true;
      this.logger.warn(
        '[checkAuth] Repeated error output is suppressed until the next successful request',
      );
    }

    return hasResponseError;
  }

  /** Сбрасывает серию ошибок только после успешного ответа social-connect. */
  private logCheckAuthRecovery() {
    const failure = this.checkAuthFailure;
    if (!failure) {
      return;
    }

    const requestWord = failure.count === 1 ? 'request' : 'requests';
    this.logger.log(
      `[checkAuth] Social connect request recovered after ${failure.count} failed ${requestWord}`,
    );
    this.checkAuthFailure = undefined;
  }

  /** Возвращает безопасную сигнатуру ошибки без тела HTTP-ответа. */
  private getCheckAuthFailureDetails(err: unknown) {
    if (axios.isAxiosError(err)) {
      const responseError = this.getSocialConnectResponseError(
        err.response?.data,
      );
      const status = err.response?.status ?? 'no-status';
      const errorCode = err.code ?? 'unknown';
      const errorMessage = responseError?.message ?? err.message;

      return {
        hasResponseError: !!responseError,
        signature: `axios:${errorCode}:${status}:${responseError?.code ?? ''}:${errorMessage}`,
      };
    }

    if (err instanceof Error) {
      return {
        hasResponseError: false,
        signature: `error:${err.name}:${err.message}`,
      };
    }

    return {
      hasResponseError: false,
      signature: `unknown:${String(err)}`,
    };
  }

  /** Выделяет известное API-описание ошибки, не передавая его в signature целиком. */
  private getSocialConnectResponseError(data: unknown) {
    if (
      !data ||
      typeof data !== 'object' ||
      !('error' in data) ||
      !data.error ||
      typeof data.error !== 'object' ||
      !('code' in data.error) ||
      !('message' in data.error)
    ) {
      return;
    }

    const { code, message } = data.error;
    if (typeof code !== 'number' || typeof message !== 'string') {
      return;
    }

    return { code, message };
  }

  /** Сохраняет прежний подробный формат первых двух записей в логе. */
  private logCheckAuthError(err: unknown, hasResponseError: boolean) {
    if (axios.isAxiosError(err)) {
      if (hasResponseError) {
        this.logger.debug('[checkAuth] error', err.response?.data);
        return;
      }

      this.logger.error('[checkAuth] Axios error', {
        code: err.code,
        message: err.message,
      });
      return;
    }

    this.logger.error('[checkAuth]', err);
  }
}
