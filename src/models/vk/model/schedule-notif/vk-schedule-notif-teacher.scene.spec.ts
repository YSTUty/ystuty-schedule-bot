import { VkScheduleNotifTeacherScene } from './vk-schedule-notif-teacher.scene';

describe('VkScheduleNotifTeacherScene', () => {
  it('creates a teacher notification from a draft without changing the profile teacher', async () => {
    const notifService = {
      createForUserSocial: jest.fn().mockResolvedValue({ id: 7 }),
      getNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: '42',
        deliveryHour: 8,
        deliveryMinute: 30,
        period: 'day',
        targetDayOffset: 0,
        weekdays: [1],
      }),
    };
    const draftService = {
      consume: jest.fn().mockResolvedValue({
        userSocialId: 2,
        settings: {
          deliveryHour: 8,
          deliveryMinute: 30,
          period: 'day',
          targetDayOffset: 0,
          weekdays: [1],
        },
      }),
    };
    const scheduleService = {
      getTeacher: jest.fn().mockReturnValue({ id: 42 }),
      getTeacherName: jest.fn().mockReturnValue('Иванов И. И.'),
    };
    const keyboardFactory = {
      getScheduleNotifEditor: jest
        .fn()
        .mockReturnValue({ inline: jest.fn().mockReturnValue({}) }),
    };
    const scene = new VkScheduleNotifTeacherScene(
      notifService as any,
      draftService as any,
      scheduleService as any,
      keyboardFactory as any,
    );
    const ctx = {
      isDM: true,
      eventPayload: {
        scheduleNotifTeacherAction: 'select',
        teacherId: 42,
      },
      senderId: 5,
      peerId: 10,
      state: { userSocial: { id: 2 } },
      scene: {
        state: { draftId: '0123456789ab' },
        step: { firstTime: false },
        leave: jest.fn(async () => {
          ctx.scene.state = {} as any;
        }),
      },
      answer: jest.fn(),
      isMessageEventContext: jest.fn().mockReturnValue(true),
      editMessage: jest.fn(),
    };

    await scene.step(ctx as any);

    expect(draftService.consume).toHaveBeenCalledWith('0123456789ab', {
      transport: 'vkontakte',
      ownerId: 5,
      peerId: 10,
    });
    expect(notifService.createForUserSocial).toHaveBeenCalledWith(
      ctx.state.userSocial,
      { type: 'teacher', id: '42' },
      expect.objectContaining({ deliveryHour: 8, deliveryMinute: 30 }),
    );
    expect(notifService.getNotif).toHaveBeenCalledWith(2, 7);
    expect(ctx.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Иванов И. И.'),
      }),
    );
  });

  it('creates a teacher notification for a conversation from its draft', async () => {
    const notifService = {
      createForConversation: jest.fn().mockResolvedValue({ id: 7 }),
      getConversationNotif: jest.fn().mockResolvedValue({
        id: 7,
        targetId: '42',
        deliveryHour: 8,
        deliveryMinute: 30,
        period: 'day',
        targetDayOffset: 0,
        weekdays: [1],
      }),
    };
    const scene = new VkScheduleNotifTeacherScene(
      notifService as any,
      {
        consume: jest.fn().mockResolvedValue({
          userSocialId: 2,
          settings: {
            deliveryHour: 8,
            deliveryMinute: 30,
            period: 'day',
            targetDayOffset: 0,
            weekdays: [1],
          },
        }),
      } as any,
      {
        getTeacher: jest.fn().mockReturnValue({ id: 42 }),
        getTeacherName: jest.fn().mockReturnValue('Иванов И. И.'),
      } as any,
      {
        getScheduleNotifEditor: jest
          .fn()
          .mockReturnValue({ inline: jest.fn().mockReturnValue({}) }),
      } as any,
    );
    const ctx = {
      isDM: false,
      eventPayload: { scheduleNotifTeacherAction: 'select', teacherId: 42 },
      senderId: 5,
      peerId: 20,
      state: { userSocial: { id: 2 }, conversation: { id: 3 } },
      scene: {
        state: { draftId: '0123456789ab' },
        step: { firstTime: false },
        leave: jest.fn(),
      },
      answer: jest.fn(),
      isMessageEventContext: jest.fn().mockReturnValue(true),
      editMessage: jest.fn(),
    };

    await scene.step(ctx as any);

    expect(notifService.createForConversation).toHaveBeenCalledWith(
      ctx.state.conversation,
      { type: 'teacher', id: '42' },
      expect.objectContaining({ deliveryHour: 8 }),
    );
    expect(notifService.getConversationNotif).toHaveBeenCalledWith(3, 7);
  });
});
