import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { IncomingMessage } from 'http';

import * as xEnv from '@my-environment';
import { LocalePhrase, UserInfo } from '@my-interfaces';
import { oAuth } from '@my-common';
import { SocialType } from '@my-common/constants';
import { i18n as i18nTg } from '@my-common/util/tg';
import { i18n as i18nVk } from '@my-common/util/vk';

import { TelegramService } from '../telegram/telegram.service';
import { TelegramKeyboardFactory } from '../telegram/telegram-keyboard.factory';
import * as telegramConstants from '../telegram/telegram.constants';
import { VkService } from '../vk/vk.service';
import { VKKeyboardFactory } from '../vk/vk-keyboard.factory';
import * as vkConstants from '../vk/vk.constants';

@Injectable()
export class UserService {
  constructor(
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => VkService))
    private readonly vkService: VkService,
    private readonly tgKeyboardFactory: TelegramKeyboardFactory,
    private readonly vkKeyboardFactory: VKKeyboardFactory,
  ) {}

  public async auth(
    socialType: SocialType,
    socialId: number,
    auth: { code?: string; access_token?: string; refresh_token?: string },
  ) {
    let userSocial: { user?: UserInfo } & Record<string, any> /* UserSocial */;

    const i18n = (
      socialType === SocialType.Telegram ? i18nTg : i18nVk
    ).createContext('ru', {});

    if (socialType === SocialType.Telegram) {
      const [session = {}, close] =
        await this.telegramService.emulateSession(socialId);

      const inScene =
        session.__scenes?.current === telegramConstants.AUTH_SCENE;

      const uscl = await this.authUserSocial(
        socialType,
        socialId,
        auth,
        session,
      );
      if (uscl === false) {
        await this.telegramService.sendMessage(
          socialId,
          i18n.t(LocalePhrase.Page_Auth_Fail),
        );
      }
      if (!uscl) {
        return false;
      }
      userSocial = uscl;

      const text = i18n.t(LocalePhrase.Page_Auth_Done, {
        user: userSocial.user,
      });
      await this.telegramService.sendMessage(socialId, text);

      if (userSocial.user.groupName) {
        const keyboard = this.tgKeyboardFactory.getSelectGroupInline(
          { i18n } as any,
          userSocial.user.groupName,
        );
        await this.telegramService.sendMessage(socialId, 'Action', keyboard);
      }

      if (inScene) {
        delete session.__scenes;
      }
      await close();

      return true;
    } else if (socialType === SocialType.Vkontakte) {
      const [session, close] = await this.vkService.emulateSession(socialId);
      const inScene = session?.__scene?.current === vkConstants.AUTH_SCENE;

      const uscl = await this.authUserSocial(
        socialType,
        socialId,
        auth,
        session,
      );
      if (uscl === false) {
        await this.vkService.sendMessage(
          socialId,
          i18n.t(LocalePhrase.Page_Auth_Fail),
        );
      }
      if (!uscl) {
        return false;
      }
      userSocial = uscl;

      const text = i18n.t(LocalePhrase.Page_Auth_Done, {
        user: userSocial.user,
      });
      await this.vkService.sendMessage(socialId, text);

      if (userSocial.user.groupName) {
        const keyboard = this.vkKeyboardFactory
          .getSelectGroup({ i18n } as any, userSocial.user.groupName)
          .inline();
        await this.vkService.sendMessage(socialId, 'Action', { keyboard });
      }

      if (inScene) {
        delete session.__scene;
      }
      await close();

      return true;
    }

    console.log('Fail: other');
    return false;
  }

  async authUserSocial(
    socialType: SocialType,
    socialId: number,
    auth: { code?: string; access_token?: string; refresh_token?: string },
    userSocial: {
      user?: UserInfo;
      selectedGroupName?: string;
    } & Record<string, any>,
  ) {
    // const userSocial = await this.findBySocialId(socialType, socialId);

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

    /* const user = await this.save(
      {
        externalId: userData.user.id,
        fullname: userData.user.fullName,
        login: userData.user.login,
        groupName: userData.user.groupName,
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      },
      // false,
    ); */
    const user = {
      externalId: userData.user.id,
      fullname: userData.user.fullName,
      login: userData.user.login,
      groupName: userData.user.groupName,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
    };

    // if (!userSocial.selectedGroupName) {
    //   userSocial.selectedGroupName = userData.user.groupName;
    // }
    userSocial.user = user;
    // await this.saveUserSocial(userSocial);
    return userSocial;
  }
}