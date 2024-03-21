import { Inject, Injectable, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { IncomingMessage } from 'http';

import * as xEnv from '@my-environment';
import { LocalePhrase } from '@my-interfaces';
import { ISessionState as VkISessionState } from '@my-interfaces/vk';
import { oAuth } from '@my-common';
import { SocialType } from '@my-common/constants';
import { i18n as i18nTg } from '@my-common/util/tg';
import { i18n as i18nVk } from '@my-common/util/vk';

import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import { TelegramService } from '../telegram/telegram.service';
import { TelegramKeyboardFactory } from '../telegram/telegram-keyboard.factory';
import * as telegramConstants from '../telegram/telegram.constants';
import { VkService } from '../vk/vk.service';
import { VKKeyboardFactory } from '../vk/vk-keyboard.factory';
import * as vkConstants from '../vk/vk.constants';

import { User } from './entity/user.entity';
import { UserSocial } from './entity/user-social.entity';

@Injectable()
export class UserService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,

    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => VkService))
    private readonly vkService: VkService,
    private readonly tgKeyboardFactory: TelegramKeyboardFactory,
    private readonly vkKeyboardFactory: VKKeyboardFactory,
  ) {}

  public async onModuleInit() {
    try {
      const countUsers = await this.userRepository.count({
        isBanned: Not(true),
      });
      this.metricsService.userCounter.remove();
      this.metricsService.userCounter.set(countUsers);

      this.metricsService.userSocialCounter.remove('social');
      for (const social of Object.values(SocialType)) {
        const countSocial = await this.userSocialRepository.count({
          social,
          isBlockedBot: Not(true),
        });
        this.metricsService.userSocialCounter.set({ social }, countSocial);
      }
    } catch (err) {
      console.log('[onModuleInit] Error loading metrics');
      console.error(err);
    }
  }

  public async getUser(userId: number, lock = false) {
    return await this.userRepository.findOne(userId, {
      ...(lock && { lock: { mode: 'pessimistic_write' } }),
    });
  }

  /** Create or Update user */
  public async save(user: Partial<User>, useLock = true) {
    const lock =
      useLock &&
      (await this.redisService.redlock.lock(
        `save.${user.id || user.externalId + 'x'}`,
        30e3,
      ));
    try {
      // let curUser = await this.userRepository.findOne(user);
      let curUser = await this.userRepository.findOne({
        where: [{ id: user.id }, { externalId: user.externalId }],
      });
      if (curUser) {
        user = { ...curUser, ...user };
      } else {
        this.metricsService.userCounter.inc();
      }
      return await this.userRepository.save(new User(user));
    } finally {
      useLock && (await lock.unlock());
    }
  }

  public async getOrCreate(user: Partial<User>, useLock = true) {
    const lock =
      useLock &&
      (await this.redisService.redlock.lock(
        `getOrCreateUser.${user.id || user.externalId + 'x'}`,
        30e3,
      ));
    try {
      let curUser = await this.userRepository.findOne({
        where: [{ id: user.id }, { externalId: user.externalId }],
      });

      if (!curUser) {
        curUser = await this.userRepository.save(new User(user));
        this.metricsService.userCounter.inc();
      }
      return curUser;
    } finally {
      useLock && (await lock.unlock());
    }
  }

  public async saveUserSocial(userSocial: UserSocial) {
    return await this.userSocialRepository.save(userSocial);
  }

  public async createUserSocial(
    provider: SocialType,
    profile: Partial<UserSocial>,
    user?: User,
  ) {
    profile.social = provider;
    profile.user = user;
    this.metricsService.userSocialCounter.inc({ social: provider });
    const userSocial = new UserSocial(
      await this.userSocialRepository.save(profile),
    );

    return userSocial;
  }

  public async findBySocialId(social: SocialType, socialId: number) {
    const userSocial = await this.userSocialRepository.findOne(
      { socialId, social },
      { relations: ['user'] },
    );

    return userSocial;
  }

  public async auth(
    socialType: SocialType,
    socialId: number,
    auth:
      | { code?: string; access_token?: string; refresh_token?: string }
      | false,
  ) {
    const i18n = (
      socialType === SocialType.Telegram ? i18nTg : i18nVk
    ).createContext('ru', {});

    const socialService =
      socialType === SocialType.Telegram
        ? this.telegramService
        : this.vkService;

    const [session, close] = await (socialType === SocialType.Telegram
      ? this.telegramService
      : this.vkService
    ).emulateSession(socialId);

    if (auth) {
      const userSocial = await this.authUserSocial(socialType, socialId, auth);
      if (userSocial === false) {
        await socialService.sendMessage(
          socialId,
          i18n.t(LocalePhrase.Page_Auth_Fail),
        );
      }
      if (!userSocial) {
        return false;
      }

      await socialService.sendMessage(
        socialId,
        i18n.t(LocalePhrase.Page_Auth_Done, {
          user: userSocial.user,
        }),
      );

      if (
        userSocial.user.groupName &&
        userSocial.user.groupName !== userSocial.groupName
      ) {
        if (socialType === SocialType.Telegram) {
          const keyboard = this.tgKeyboardFactory.getSelectGroupInline(
            { i18n } as any,
            userSocial.user.groupName,
          );
          await socialService.sendMessage(
            socialId,
            '┬┴┬┴┤ ͜ʖ ͡°) ├┬┴┬┴',
            keyboard,
          );
        } else if (socialType === SocialType.Vkontakte) {
          const keyboard = this.vkKeyboardFactory
            .getSelectGroup({ i18n } as any, userSocial.user.groupName)
            .inline();
          await this.vkService.sendMessage(socialId, '┬┴┬┴┤ ͜ʖ ͡°) ├┬┴┬┴', {
            keyboard,
          });
        }
      }
    } else {
      await socialService.sendMessage(
        socialId,
        i18n.t(LocalePhrase.Page_Auth_Cancel),
      );
    }

    if (socialType === SocialType.Telegram) {
      if (session.__scenes?.current === telegramConstants.AUTH_SCENE) {
        delete session.__scenes;
      }
    } else if (socialType === SocialType.Vkontakte) {
      if (
        (session as VkISessionState)?.__scene?.current ===
        vkConstants.AUTH_SCENE
      ) {
        delete (session as VkISessionState).__scene;
      }
    }

    await close();
    return true;
  }

  async authUserSocial(
    socialType: SocialType,
    socialId: number,
    auth: { code?: string; access_token?: string; refresh_token?: string },
  ) {
    const userSocial = await this.findBySocialId(socialType, socialId);

    if (!userSocial || userSocial.userId) {
      console.log('Fail: userSocial');
      return false;
    }

    if (auth.code) {
      const oAuthResult = await new Promise<{
        err: { statusCode: number; data?: any };
        access_token: string;
        refresh_token: string;
        result: any;
      }>((resolve) =>
        oAuth.getOAuthAccessToken(
          auth.code,
          { grant_type: 'authorization_code' },
          (err, access_token, refresh_token, result) => {
            resolve({ err, access_token, refresh_token, result });
          },
        ),
      );
      auth.access_token = oAuthResult.access_token;
      auth.refresh_token = oAuthResult.refresh_token;
    }

    if (!auth.access_token) {
      return false;
    }

    const oauthData = await new Promise<{
      err: { statusCode: number; data?: any };
      result?: string | Buffer;
      response?: IncomingMessage;
    }>((resolve) =>
      oAuth.getProtectedResource(
        xEnv.OAUTH_URL + '/check',
        auth.access_token,
        (err, result, response) => resolve({ err, result, response }),
      ),
    );

    if (oauthData.err?.statusCode === 403) {
      return false;
    }

    if (!oauthData.result) {
      return null;
    }

    let userData: {
      auth: number;
      userId: number;
      user: {
        id: number;
        firstName: string;
        lastName: string;
        patronymic: string;
        fullName: string;
        initials: string;
        avatarUrl: string;
        birthday: string;
        login: string;
        groupName?: string;
      };
    };
    try {
      userData = JSON.parse(oauthData.result as string).auth_info;
    } catch {
      return false;
    }

    const user = await this.save({
      externalId: userData.user.id,
      fullname: userData.user.fullName,
      login: userData.user.login,
      groupName: userData.user.groupName,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
    });
    userSocial.user = user;

    // if (!user.groupName) {
    //   userSocial.groupName = userData.user.groupName;
    // }
    await this.saveUserSocial(userSocial);
    return userSocial;
  }
}
