import { Injectable, Logger } from '@nestjs/common';
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

  constructor(
    private readonly httpService: HttpService,
    private readonly userService: UserService,
  ) {}

  public get isAvailable() {
    return !!xEnv.SOCAIL_CONNECT_URI;
  }

  public async requestAuth(socialType: SocialType, socialId: number) {
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
      console.log({ data });
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as {
          error: { code: number; message: string; error: string };
        };
        if ('error' in data && data.error.code === 404) {
          return { error: 'client not found' };
        }
      }
      console.log(err);
    }

    return { error: 'see log' };
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
          }[];
        }>(`connect/check`, {
          client_id: xEnv.OAUTH_CLIENT_ID,
          client_secret: xEnv.OAUTH_CLIENT_SECRET,
        }),
      );

      if (!data.result || data.result.length === 0) {
        return;
      }

      console.log('checkAuth', data);
      const { result } = data;
      for (const item of result) {
        try {
          const res = await this.userService.auth(
            item.socialType,
            item.socialId,
            {
              access_token: item.accessToken,
              refresh_token: item.refreshToken,
            },
          );
          this.logger.log(`res (${item.socialId}): ${res}`);
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
  }
}
