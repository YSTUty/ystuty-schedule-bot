import { SocialType } from '@my-common/constants';

import { Conversation } from '../social/entity/conversation.entity';
import { UserSocial } from '../user/entity/user-social.entity';
import { User } from '../user/entity/user.entity';

import { MetricsService } from './metrics.service';

const createGauge = () => ({
  inc: jest.fn(),
  reset: jest.fn(),
  set: jest.fn(),
});

describe('MetricsService', () => {
  it('restores domain gauges with bounded status labels from the database', async () => {
    const userCounter = createGauge();
    const userStatusCounter = createGauge();
    const userSocialCounter = createGauge();
    const userSocialStatusCounter = createGauge();
    const conversationCounter = createGauge();
    const conversationStatusCounter = createGauge();
    const scheduleRequestCounter = { inc: jest.fn() };
    const telegramRequestCounter = { inc: jest.fn() };
    const vkRequestCounter = { inc: jest.fn() };
    const histogram = { startTimer: jest.fn() };
    const getGauge = jest
      .fn()
      .mockReturnValueOnce(userCounter)
      .mockReturnValueOnce(userStatusCounter)
      .mockReturnValueOnce(userSocialCounter)
      .mockReturnValueOnce(userSocialStatusCounter)
      .mockReturnValueOnce(conversationCounter)
      .mockReturnValueOnce(conversationStatusCounter);
    const getCounter = jest
      .fn()
      .mockReturnValueOnce(scheduleRequestCounter)
      .mockReturnValueOnce(telegramRequestCounter)
      .mockReturnValueOnce(vkRequestCounter);
    const userRepository = {
      find: jest
        .fn()
        .mockResolvedValue([{ isBanned: false }, { isBanned: true }]),
    };
    const userSocialRepository = {
      find: jest.fn().mockResolvedValue([
        {
          social: SocialType.Telegram,
          isBlockedBot: false,
          hasDM: true,
          userId: 1,
        },
        {
          social: SocialType.Telegram,
          isBlockedBot: true,
          hasDM: false,
          userId: null,
        },
        {
          social: SocialType.Vkontakte,
          isBlockedBot: false,
          hasDM: false,
          userId: null,
        },
      ]),
    };
    const conversationRepository = {
      find: jest.fn().mockResolvedValue([
        {
          social: SocialType.Telegram,
          isLeaved: false,
          chatStatus: 'member',
        },
        {
          social: SocialType.Telegram,
          isLeaved: true,
          chatStatus: 'kicked',
        },
        {
          social: SocialType.Vkontakte,
          isLeaved: false,
          chatStatus: null,
        },
        {
          social: SocialType.Vkontakte,
          isLeaved: false,
          chatStatus: 'unexpected-status',
        },
      ]),
    };
    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === User) return userRepository;
        if (entity === UserSocial) return userSocialRepository;
        if (entity === Conversation) return conversationRepository;
        throw new Error('Unexpected repository');
      }),
    };
    const metricsService = new MetricsService(
      {
        getCounter,
        getGauge,
        getHistogram: jest.fn().mockReturnValue(histogram),
      } as never,
      dataSource as never,
    );

    await metricsService.refreshDomainGauges();
    metricsService.incrementScheduleRequest('group', 'ЦИС-17');

    expect(userCounter.set).toHaveBeenCalledWith(1);
    expect(scheduleRequestCounter.inc).toHaveBeenCalledWith({
      target_type: 'group',
    });
    expect(metricsService.scheduleTargetRequestCounter).toBeNull();
    expect(userStatusCounter.set).toHaveBeenCalledWith({ status: 'active' }, 1);
    expect(userStatusCounter.set).toHaveBeenCalledWith({ status: 'banned' }, 1);
    expect(userSocialCounter.set).toHaveBeenCalledWith(
      { social: SocialType.Telegram },
      1,
    );
    expect(userSocialCounter.set).toHaveBeenCalledWith(
      { social: SocialType.Vkontakte },
      0,
    );
    expect(userSocialStatusCounter.set).toHaveBeenCalledWith(
      {
        social: SocialType.Telegram,
        is_blocked: 'true',
        has_dm: 'false',
        is_authorized: 'false',
      },
      1,
    );
    expect(userSocialStatusCounter.set).toHaveBeenCalledWith(
      {
        social: SocialType.Telegram,
        is_blocked: 'false',
        has_dm: 'true',
        is_authorized: 'true',
      },
      1,
    );
    expect(conversationCounter.set).toHaveBeenCalledWith(
      { social: SocialType.Telegram },
      2,
    );
    expect(conversationStatusCounter.set).toHaveBeenCalledWith(
      {
        social: SocialType.Vkontakte,
        is_leaved: 'false',
        chat_status: 'unknown',
      },
      1,
    );
    expect(conversationStatusCounter.set).toHaveBeenCalledWith(
      {
        social: SocialType.Vkontakte,
        is_leaved: 'false',
        chat_status: 'other',
      },
      1,
    );
  });

  it('does not wait for Pushgateway during bootstrap', async () => {
    const metricsService = new MetricsService(
      {
        getCounter: jest.fn(),
        getGauge: jest.fn(),
        getHistogram: jest.fn(),
      } as never,
      {} as never,
    );
    const refreshDomainGauges = jest
      .spyOn(metricsService, 'refreshDomainGauges')
      .mockResolvedValue();
    const pushMetricsToGateway = jest
      .spyOn(
        metricsService as unknown as {
          pushMetricsToGateway: () => Promise<void>;
        },
        'pushMetricsToGateway',
      )
      .mockReturnValue(new Promise<void>(() => undefined));

    await expect(
      metricsService.onApplicationBootstrap(),
    ).resolves.toBeUndefined();

    expect(refreshDomainGauges).toHaveBeenCalledTimes(1);
    expect(pushMetricsToGateway).toHaveBeenCalledTimes(1);
  });
});
