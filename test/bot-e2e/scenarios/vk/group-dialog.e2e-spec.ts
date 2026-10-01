import { SocialType } from '@my-common/constants';

import { e2eTrace } from '../../e2e-trace.util';
import { BotE2eHarness } from '../../harness/bot-e2e-harness';
import { waitForBackgroundUpdate } from '../scenario.util';

import type { VkSendMessageCall } from './vk-scenario.util';

const conversationId = 710101;
const peerId = 2e9 + conversationId;
const groupMemberId = 720101;

describe('VK group dialog (transport E2E)', () => {
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
    e2eTrace('VK', '→ group user sends unaddressed /start');
    harness.vk.pushChatMessage(groupMemberId, conversationId, '/start');
    await waitForBackgroundUpdate();

    expect(harness.vk.calls).not.toContainEqual(
      expect.objectContaining({
        method: 'messages.send',
        params: expect.objectContaining({ peer_id: String(peerId) }),
      }),
    );
    e2eTrace('VK', '← bot does not start a private flow without an appeal');

    const appealCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user explicitly addresses /start to the bot');
    harness.vk.pushChatMessage(
      groupMemberId,
      conversationId,
      '[club900001|YSTUty], /start',
    );

    const groupStartCall = await harness.vk.waitForNextCall<VkSendMessageCall>(
      appealCallIndex,
      'messages.send',
      (call) =>
        call.params.peer_id === String(peerId) &&
        String(call.params.message).includes('Привет! Это бот для расписания'),
    );
    expect(groupStartCall.params.keyboard).toBeDefined();

    await waitForBackgroundUpdate();
    const conversation = await harness.getConversation(
      SocialType.Vkontakte,
      conversationId,
    );
    expect(conversation).toMatchObject({ isLeaved: false });

    // В беседе не должны появиться welcome/init-карточки, полезные только в ЛС.
    const groupReplies = harness.vk.calls.filter(
      (call) =>
        call.method === 'messages.send' &&
        call.params.peer_id === String(peerId),
    );
    expect(groupReplies).toHaveLength(1);
    e2eTrace('VK', '← group conversation is persisted without private cards');
  });

  it('uses the chat title as its schedule target and ignores unaddressed schedule requests', async () => {
    const titledConversationId = 710102;
    const titledPeerId = 2e9 + titledConversationId;
    const titledMemberId = 720102;

    e2eTrace('VK', '→ chat_title_update: chat title changes to ИВТ-101');
    harness.vk.pushChatTitleUpdate(
      titledMemberId,
      titledConversationId,
      'ИВТ-101',
    );
    await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) =>
        call.params.peer_id === String(titledPeerId) &&
        String(call.params.message).includes('выбрана автоматически'),
    );
    await waitForBackgroundUpdate();
    const conversation = await harness.getConversation(
      SocialType.Vkontakte,
      titledConversationId,
    );
    expect(conversation?.groupName).toBe('ИВТ-101');

    const unaddressedCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user sends unaddressed schedule request');
    harness.vk.pushChatMessage(
      titledMemberId,
      titledConversationId,
      'Расписание',
    );
    await waitForBackgroundUpdate();
    expect(
      harness.vk.calls
        .slice(unaddressedCallIndex)
        .filter((call) => call.method === 'messages.send'),
    ).toHaveLength(0);

    const scheduleCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user addresses the schedule request to the bot');
    harness.vk.pushChatMessage(
      titledMemberId,
      titledConversationId,
      '[club900001|YSTUty], Расписание',
    );
    const scheduleCall = await harness.vk.waitForNextCall<VkSendMessageCall>(
      scheduleCallIndex,
      'messages.send',
      (call) =>
        call.params.peer_id === String(titledPeerId) &&
        String(call.params.message).includes('E2E текущая неделя'),
    );
    expect(String(scheduleCall.params.message)).toContain('ИВТ-101');
    e2eTrace(
      'VK',
      '← schedule uses Conversation.groupName after explicit appeal',
    );
  });
});
