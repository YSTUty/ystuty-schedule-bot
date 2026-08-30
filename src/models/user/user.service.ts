import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { IncomingMessage } from 'http';

import * as xEnv from '@my-environment';

import { oAuth } from '@my-common';
import { SocialType } from '@my-common/constants';
import { i18n as i18nTg } from '@my-common/util/tg';
import { i18n as i18nVk } from '@my-common/util/vk';
import { IOAuthCheck_auth_info, LocalePhrase } from '@my-interfaces';
import { ISessionState as TgISessionState } from '@my-interfaces/telegram';
import { ISessionState as VkISessionState } from '@my-interfaces/vk';

import * as tgConstants from '../telegram/telegram.constants';
import * as vkConstants from '../vk/vk.constants';
import { ConcurrencyService } from '../concurrency/concurrency.service';
import { MetricsService } from '../metrics/metrics.service';
import { SocialConnectService } from '../social-connect/social-connect.service';
import { TelegramKeyboardFactory } from '../telegram/telegram-keyboard.factory';
import { TelegramService } from '../telegram/telegram.service';
import { VKKeyboardFactory } from '../vk/vk-keyboard.factory';
import { VkService } from '../vk/vk.service';

import { UserSocial } from './entity/user-social.entity';
import { User } from './entity/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSocial)
    private readonly userSocialRepository: Repository<UserSocial>,

    @Inject(forwardRef(() => SocialConnectService))
    private readonly socialConnectService: SocialConnectService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly metricsService: MetricsService,
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => VkService))
    private readonly vkService: VkService,
    private readonly tgKeyboardFactory: TelegramKeyboardFactory,
    private readonly vkKeyboardFactory: VKKeyboardFactory,
  ) {}

  private getMessengerService(socialType: SocialType) {
    if (socialType === SocialType.Telegram) {
      return this.telegramService;
    }
    if (socialType === SocialType.Vkontakte) {
      return this.vkService;
    }
    return null;
  }

  public async getUser(userId: number, lock = false) {
    return await this.userRepository.findOne({
      where: { id: userId },
      ...(lock && { lock: { mode: 'pessimistic_write' } }),
    });
  }

  /** Create or Update user */
  public async save(user: Partial<User>, useLock = true) {
    const saveUser = async () => {
      // let curUser = await this.userRepository.findOne(user);
      const curUser = await this.userRepository.findOne({
        where: [{ id: user.id }, { externalId: user.externalId }],
      });
      if (curUser) {
        user = { ...curUser, ...user };
      } else if (!user.isBanned) {
        this.metricsService.userCounter.inc();
      }
      return await this.userRepository.save(new User(user));
    };

    if (!useLock) {
      return await saveUser();
    }

    return await this.concurrencyService.exclusiveLocal(
      this.concurrencyService.buildKey(
        'user:save',
        user.id || `${user.externalId}x`,
      ),
      saveUser,
    );
  }

  public async getOrCreate(user: Partial<User>, useLock = true) {
    const getOrCreateUser = async () => {
      let curUser = await this.userRepository.findOne({
        where: [{ id: user.id }, { externalId: user.externalId }],
      });

      if (!curUser) {
        curUser = await this.userRepository.save(new User(user));
        if (!user.isBanned) {
          this.metricsService.userCounter.inc();
        }
      }
      return curUser;
    };

    if (!useLock) {
      return await getOrCreateUser();
    }

    return await this.concurrencyService.exclusiveLocal(
      this.concurrencyService.buildKey(
        'user:getOrCreate',
        user.id || `${user.externalId}x`,
      ),
      getOrCreateUser,
    );
  }

  public async saveUserSocial(userSocial: UserSocial) {
    return await this.userSocialRepository.save(userSocial);
  }

  public async unlinkUser(userSocial: UserSocial) {
    await this.socialConnectService.unAuth(
      userSocial.social,
      userSocial.socialId,
    );

    await this.userSocialRepository.update(userSocial.id, {
      user: null,
      userId: null,
    });

    // await this.userRepository.delete(userSocial.user.id);
  }

  public async createUserSocial(
    provider: SocialType,
    profile: Partial<UserSocial>,
    user?: User,
  ) {
    profile.social = provider;
    profile.user = user;
    if (profile.hasDM && !profile.isBlockedBot) {
      this.metricsService.userSocialCounter.inc({ social: provider });
    }
    const userSocial = new UserSocial(
      await this.userSocialRepository.save(profile),
    );

    return userSocial;
  }

  public async findBySocialId(social: SocialType, socialId: number) {
    const userSocial = await this.userSocialRepository.findOne({
      where: { socialId, social },
      relations: ['user'],
    });

    return userSocial;
  }

  public async findBySocialIds(social: SocialType, socialIds: number[]) {
    const userSocials = await this.userSocialRepository.find({
      where: { socialId: In(socialIds), social },
      relations: ['user'],
    });

    return userSocials;
  }

  public async findSocials(user: User) {
    const userSocials = await this.userSocialRepository.find({
      where: { user },
    });

    return userSocials;
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

    const socialService = this.getMessengerService(socialType);
    if (!socialService?.isActive) {
      return false;
    }

    const [session, close] = await socialService.emulateSession(socialId);

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

      const linkedUser = userSocial.user;
      if (!linkedUser) {
        return false;
      }

      await socialService.sendMessage(
        socialId,
        i18n.t(LocalePhrase.Page_Auth_Done, {
          user: linkedUser,
        }),
      );

      if (socialType === SocialType.Telegram) {
        await this.telegramService.syncPrivateChatCommands({
          chatId: socialId,
          isAuthorized: true,
          isAdmin: this.telegramService.isAdmin(socialId, linkedUser.role),
          hasGroup: !!userSocial.groupName,
          teacherId: (session as TgISessionState | null)?.teacherId,
        });
      }

      if (
        linkedUser.groupName &&
        linkedUser.groupName !== userSocial.groupName
      ) {
        if (socialType === SocialType.Telegram) {
          const keyboard = this.tgKeyboardFactory.getSelectGroupInline(
            { i18n } as any,
            linkedUser.groupName,
          );
          await socialService.sendMessage(
            socialId,
            '┬┴┬┴┤ ͜ʖ ͡°) ├┬┴┬┴',
            keyboard,
          );
        } else if (socialType === SocialType.Vkontakte) {
          const keyboard = this.vkKeyboardFactory
            .getSelectGroup({ i18n } as any, linkedUser.groupName)
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

    // * Force exit from auth scene
    try {
      if (socialType === SocialType.Telegram) {
        const sess = session as TgISessionState;
        if (sess.__scenes?.current === tgConstants.AUTH_SCENE) {
          delete sess.__scenes;
        }
      } else if (socialType === SocialType.Vkontakte) {
        const sess = session as VkISessionState;
        if (sess?.__scene?.current === vkConstants.AUTH_SCENE) {
          delete sess.__scene;
        }
      }

      await close();
    } catch (err) {
      this.logger.debug(`Error on [auth] emulate session`);
      console.error(err);
    }
    return true;
  }

  async authUserSocial(
    socialType: SocialType,
    socialId: number,
    auth: { code?: string; access_token?: string; refresh_token?: string },
  ) {
    const userSocial = await this.findBySocialId(socialType, socialId);

    if (!userSocial || userSocial.userId) {
      console.log(
        `Fail: userSocial (social ${!userSocial ? 'empty' : 'exists'})`,
      );
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
          auth.code!,
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
        auth.access_token!,
        (err, result, response) => resolve({ err, result, response }),
      ),
    );

    if (oauthData.err?.statusCode === 403) {
      return false;
    }

    if (!oauthData.result) {
      return null;
    }

    let userData: IOAuthCheck_auth_info;
    try {
      userData = JSON.parse(oauthData.result as string).auth_info;
    } catch {
      return false;
    }

    const user = await this.save({
      // Create or update
      id: userSocial.userId || undefined,
      isRewoked: false,

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

  async updateUserData(userSocial: UserSocial, update = true) {
    const { user } = userSocial;

    if (!user) {
      return 'No user';
    }

    const oauthData = await new Promise<{
      err: { statusCode: number; data?: any };
      result?: string | Buffer;
    }>((resolve) =>
      oAuth.getProtectedResource(
        xEnv.OAUTH_URL + '/check',
        user.accessToken,
        (err, result) => resolve({ err, result }),
      ),
    );

    console.log(
      `[update_profile] oauthData [${userSocial.social}:${userSocial.socialId}]`,
      oauthData,
    );

    if (
      update &&
      oauthData.err?.statusCode &&
      [403, 401].includes(oauthData.err?.statusCode)
    ) {
      user.isRewoked = true;
      await this.save(user);
    }

    if (oauthData.err?.statusCode === 403) {
      return 'Wrong token';
    }

    if (oauthData.err?.statusCode === 401) {
      return 'Token expired';
    }

    if (!oauthData.result) {
      return 'No data';
    }

    let userData: IOAuthCheck_auth_info;
    try {
      userData = JSON.parse(oauthData.result as string).auth_info;
    } catch {
      return false;
    }

    if (update) {
      user.isRewoked = false;

      user.externalId = userData.user.id;
      user.fullname = userData.user.fullName;
      user.login = userData.user.login;
      user.groupName = userData.user.groupName || null;

      await this.save(user);
    }

    return userData;
  }
}
