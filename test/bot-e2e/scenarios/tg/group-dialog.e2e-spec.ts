import { SocialType } from '@my-common/constants';

import { e2eTrace } from '../../e2e-trace.util';
import { BotE2eHarness } from '../../harness/bot-e2e-harness';
import { waitForBackgroundUpdate } from '../scenario.util';

import { hasTgCallback } from './tg-scenario.util';
import type {
  TgAnswerCallbackCall,
  TgEditMessageCall,
  TgSendMessageCall,
} from './tg-scenario.util';

const groupChat = {
  id: -100710101,
  type: 'supergroup' as const,
  title: 'E2E group chat',
};

const groupMember = {
  id: 710101,
  firstName: 'Участник E2E',
  username: 'e2e_group_member',
};

describe('Telegram group dialog (transport E2E)', () => {
  let harness: BotE2eHarness;

  beforeAll(async () => {
    harness = await BotE2eHarness.start();
  }, 30e3);

  beforeEach(async () => {
    await harness.resetScenario();
  }, 30e3);

  afterAll(async () => {
    await harness?.close();
  }, 30e3);

  it('ignores an unaddressed start command and handles an explicit group appeal', async () => {
    e2eTrace('TG', '→ group user sends unaddressed /start');
    harness.telegram.pushChatText(groupMember, groupChat, '/start');
    await waitForBackgroundUpdate();

    expect(harness.telegram.calls).not.toContainEqual(
      expect.objectContaining({
        method: 'sendMessage',
        params: expect.objectContaining({ chat_id: String(groupChat.id) }),
      }),
    );
    e2eTrace('TG', '← bot does not start a private flow without an appeal');

    const appealCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user explicitly addresses /start to the bot');
    harness.telegram.pushChatText(
      groupMember,
      groupChat,
      '/start @ystuty_schedule_e2e_bot',
    );

    const groupStartCall =
      await harness.telegram.waitForNextCall<TgSendMessageCall>(
        appealCallIndex,
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === groupChat.id &&
          String(call.params.text).includes('Привет! Это бот для расписания'),
      );
    expect(Number(groupStartCall.params.chat_id)).toBe(groupChat.id);

    await waitForBackgroundUpdate();
    const conversation = await harness.getConversation(
      SocialType.Telegram,
      groupChat.id,
    );
    expect(conversation).toMatchObject({
      title: groupChat.title,
      isLeaved: false,
    });

    // Private-only welcome and initial group-picker cards would be noisy in a
    // shared chat. The main group keyboard is the only response to /start.
    const groupReplies = harness.telegram.calls.filter(
      (call) =>
        call.method === 'sendMessage' &&
        Number(call.params.chat_id) === groupChat.id,
    );
    expect(groupReplies).toHaveLength(1);
    e2eTrace('TG', '← group conversation is persisted without private cards');
  });

  it('uses the group title as its schedule target and ignores unaddressed schedule requests', async () => {
    const titledChat = { ...groupChat, id: -100710102, title: 'ИВТ-101' };
    const titledMember = { ...groupMember, id: 710102 };

    e2eTrace('TG', '→ my_chat_member: bot joins a chat titled ИВТ-101');
    harness.telegram.pushBotChatMembership(titledMember, titledChat);
    await harness.telegram.waitForCall<TgSendMessageCall>(
      'sendMessage',
      (call) =>
        Number(call.params.chat_id) === titledChat.id &&
        String(call.params.text).includes('выбрана автоматически'),
    );
    await waitForBackgroundUpdate();
    const conversation = await harness.getConversation(
      SocialType.Telegram,
      titledChat.id,
    );
    expect(conversation?.groupName).toBe('ИВТ-101');

    const unaddressedCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user sends unaddressed schedule request');
    harness.telegram.pushChatText(titledMember, titledChat, 'Расписание');
    await waitForBackgroundUpdate();
    expect(
      harness.telegram.calls
        .slice(unaddressedCallIndex)
        .filter((call) => call.method === 'sendMessage'),
    ).toHaveLength(0);

    const scheduleCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user addresses the schedule request to the bot');
    harness.telegram.pushChatText(
      titledMember,
      titledChat,
      'Расписание @ystuty_schedule_e2e_bot',
    );
    const scheduleCall =
      await harness.telegram.waitForNextCall<TgSendMessageCall>(
        scheduleCallIndex,
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === titledChat.id &&
          String(call.params.text).includes('E2E текущая неделя'),
      );
    expect(String(scheduleCall.params.text)).toContain('ИВТ-101');
    e2eTrace(
      'TG',
      '← schedule uses Conversation.groupName after explicit appeal',
    );
  });

  it('ignores unaddressed group utility text but keeps its inline selector usable', async () => {
    const selectorChat = {
      ...groupChat,
      id: -100710103,
      title: 'E2E selector chat',
    };
    const selectorMember = { ...groupMember, id: 710103 };

    // `my_chat_member` records this user as the inviter and produces the
    // initial group-selector card that a real group member can press.
    e2eTrace('TG', '→ my_chat_member: bot joins a chat without a group title');
    harness.telegram.pushBotChatMembership(selectorMember, selectorChat);
    const selectorCardCall =
      await harness.telegram.waitForCall<TgSendMessageCall>(
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === selectorChat.id &&
          hasTgCallback(call.result, 'button.select_group'),
      );
    await harness.waitForTransportIdle();

    const helpCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user sends unaddressed help text');
    harness.telegram.pushChatText(selectorMember, selectorChat, 'Помощь');
    await waitForBackgroundUpdate();
    expect(
      harness.telegram.calls
        .slice(helpCallIndex)
        .filter((call) => call.method !== 'getUpdates'),
    ).toHaveLength(0);

    e2eTrace('TG', '→ group user explicitly addresses help text');
    harness.telegram.pushChatText(
      selectorMember,
      selectorChat,
      'Помощь @ystuty_schedule_e2e_bot',
    );
    await harness.telegram.waitForCall<TgSendMessageCall>(
      'sendMessage',
      (call) =>
        Number(call.params.chat_id) === selectorChat.id &&
        String(call.params.text).includes('Краткий гайд'),
    );
    await harness.waitForTransportIdle();

    const textSelectorCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user sends unaddressed group selector text');
    harness.telegram.pushChatText(
      selectorMember,
      selectorChat,
      'Выбрать группу',
    );
    await waitForBackgroundUpdate();
    expect(
      harness.telegram.calls
        .slice(textSelectorCallIndex)
        .filter((call) => call.method !== 'getUpdates'),
    ).toHaveLength(0);

    const callbackCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ group user presses the real group-selector callback');
    const callbackId = harness.telegram.pushCallback(
      selectorMember,
      'button.select_group',
      selectorCardCall.result,
    );
    const callbackAnswer =
      await harness.telegram.waitForNextCall<TgAnswerCallbackCall>(
        callbackCallIndex,
        'answerCallbackQuery',
      );
    expect(callbackAnswer.params.callback_query_id).toBe(callbackId);
    await harness.telegram.waitForNextCall<TgEditMessageCall>(
      callbackCallIndex,
      'editMessageText',
      (call) => String(call.params.text).includes('Список институтов'),
    );
    e2eTrace('TG', '← group callback opens institutes despite no text appeal');
  });
});
