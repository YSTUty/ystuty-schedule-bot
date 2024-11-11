import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import * as rxjs from 'rxjs';

import * as xEnv from '@my-environment';
import { SocialType } from '@my-common';

import { UserService } from '../user/user.service';

@Injectable()
export class SocialConnectService {
  private readonly logger = new Logger(SocialConnectService.name);

  private checkAuthProcess = 0;

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
            | {
                status: 'auth';
              }
            | {
                status: 'unauth';
                payload: string;
              }
            | {
                status: 'process';
              }
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
        this.logger.error(err);
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
        this.logger.error(err);
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

      if (!data.result || data.result.length === 0) {
        return;
      }

      // console.log('checkAuth', data);
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
          this.logger.error(err);
        }
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as {
          error: { code: number; message: string; error: string };
        };
        if (typeof data === 'object' && 'error' in data) {
          this.logger.error(data.error);
          return;
        }
      }
      this.logger.error(err);
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
}
