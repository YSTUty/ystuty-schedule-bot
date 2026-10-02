import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';

import { e2eTrace } from '../../e2e-trace.util';
import { BotE2eHarness } from '../../harness/bot-e2e-harness';
import { waitForBackgroundUpdate } from '../scenario.util';

import { getVkCallbackPayload } from './vk-scenario.util';
import type {
  VkCallbackPayload,
  VkEditMessageCall,
  VkSendMessageCall,
} from './vk-scenario.util';

const conversationId = 710101;
const peerId = 2e9 + conversationId;
const groupMemberId = 720101;

type VkOpenGroupSelectorPayload = VkCallbackPayload & {
  phrase: 'button.select_group';
};
type VkScheduleWeekPayload = VkCallbackPayload & {
  phrase: LocalePhrase.Button_Schedule_ForWeek;
};
type VkScheduleWeekNavigationPayload = VkCallbackPayload & {
  phrase:
    | LocalePhrase.Button_Schedule_PreviousWeek
    | LocalePhrase.Button_Schedule_NextWeek;
  groupName: string;
  weekNumber: number;
};

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

  it('keeps group schedule callbacks bound to their original target and falls back from edits', async () => {
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

    // Callback payload уже содержит groupName. После переименования чата
    // старое расписание не должно неожиданно переключиться на новую группу.
    const titleUpdateCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ chat title changes to ЭК-201 after opening schedule');
    harness.vk.pushChatTitleUpdate(
      titledMemberId,
      titledConversationId,
      'ЭК-201',
    );
    await harness.vk.waitForNextCall<VkSendMessageCall>(
      titleUpdateCallIndex,
      'messages.send',
      (call) =>
        call.params.peer_id === String(titledPeerId) &&
        String(call.params.message).includes('ЭК-201'),
    );
    await waitForBackgroundUpdate();
    await expect(
      harness.getConversation(SocialType.Vkontakte, titledConversationId),
    ).resolves.toMatchObject({ groupName: 'ЭК-201' });

    const weekPayload = getVkCallbackPayload<VkScheduleWeekPayload>(
      scheduleCall,
      (payload): payload is VkScheduleWeekPayload =>
        payload.phrase === LocalePhrase.Button_Schedule_ForWeek,
    );
    const callbackCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user presses “Schedule for week” callback');
    harness.vk.pushChatMessageEvent(
      titledMemberId,
      titledConversationId,
      scheduleCall.result,
      weekPayload,
    );
    const weekEditCall = await harness.vk.waitForNextCall<VkEditMessageCall>(
      callbackCallIndex,
      'messages.edit',
      (call) =>
        call.params.peer_id === String(titledPeerId) &&
        String(call.params.message).includes('Расписание на') &&
        String(call.params.message).includes('E2E'),
    );
    expect(weekEditCall.params.conversation_message_id).toBe(
      String(scheduleCall.result),
    );
    expect(String(weekEditCall.params.message)).toContain('ИВТ-101');

    const nextWeekPayload =
      getVkCallbackPayload<VkScheduleWeekNavigationPayload>(
        weekEditCall,
        (payload): payload is VkScheduleWeekNavigationPayload =>
          payload.phrase === LocalePhrase.Button_Schedule_NextWeek &&
          typeof payload.groupName === 'string' &&
          Number.isInteger(payload.weekNumber),
      );
    const nextWeekCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user navigates to the next available week');
    harness.vk.pushChatMessageEvent(
      titledMemberId,
      titledConversationId,
      scheduleCall.result,
      nextWeekPayload,
    );
    const nextWeekEditCall =
      await harness.vk.waitForNextCall<VkEditMessageCall>(
        nextWeekCallIndex,
        'messages.edit',
        (call) =>
          call.params.peer_id === String(titledPeerId) &&
          String(call.params.message).includes('E2E следующая неделя'),
      );
    expect(String(nextWeekEditCall.params.message)).toContain('ИВТ-101');

    const previousWeekPayload =
      getVkCallbackPayload<VkScheduleWeekNavigationPayload>(
        nextWeekEditCall,
        (payload): payload is VkScheduleWeekNavigationPayload =>
          payload.phrase === LocalePhrase.Button_Schedule_PreviousWeek &&
          typeof payload.groupName === 'string' &&
          Number.isInteger(payload.weekNumber),
      );
    const previousWeekCallIndex = harness.vk.calls.length;
    // tryEditOrSendMessage() должен сохранить навигацию даже если VK больше
    // не разрешает менять исходное inline-сообщение.
    harness.vk.failNext('messages.edit', {
      error_code: 100,
      error_msg: 'One of the parameters specified was missing or invalid',
    });
    e2eTrace('VK', '→ previous-week callback cannot edit its old message');
    harness.vk.pushChatMessageEvent(
      titledMemberId,
      titledConversationId,
      scheduleCall.result,
      previousWeekPayload,
    );
    await harness.vk.waitForNextCall<VkEditMessageCall>(
      previousWeekCallIndex,
      'messages.edit',
    );
    const previousWeekFallback =
      await harness.vk.waitForNextCall<VkSendMessageCall>(
        previousWeekCallIndex,
        'messages.send',
        (call) =>
          call.params.peer_id === String(titledPeerId) &&
          String(call.params.message).includes('E2E текущая неделя'),
      );
    expect(String(previousWeekFallback.params.message)).toContain('ИВТ-101');
    e2eTrace(
      'VK',
      '← schedule callbacks preserve target, navigate weeks and recover from edit failure',
    );
  });

  it('ignores unaddressed group utility text but keeps its inline selector usable', async () => {
    const selectorConversationId = 710103;
    const selectorPeerId = 2e9 + selectorConversationId;
    const selectorMemberId = 720103;

    // VK service event records the inviter and sends the same selector card
    // that the bot shows after it is added to a real group conversation.
    e2eTrace('VK', '→ chat_invite_user: bot joins a chat without a group');
    harness.vk.pushChatInviteUser(selectorMemberId, selectorConversationId);
    const selectorCardCall = await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) =>
        call.params.peer_id === String(selectorPeerId) &&
        !!call.params.keyboard &&
        String(call.params.message).includes('Чтобы посмотреть расписание'),
    );
    const selectorPayload = getVkCallbackPayload<VkOpenGroupSelectorPayload>(
      selectorCardCall,
      (payload): payload is VkOpenGroupSelectorPayload =>
        payload.phrase === 'button.select_group',
    );
    await harness.waitForTransportIdle();

    const helpCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user sends unaddressed help text');
    harness.vk.pushChatMessage(
      selectorMemberId,
      selectorConversationId,
      'Помощь',
    );
    await waitForBackgroundUpdate();
    expect(harness.vk.calls.slice(helpCallIndex)).toHaveLength(0);

    e2eTrace('VK', '→ group user explicitly addresses help text');
    harness.vk.pushChatMessage(
      selectorMemberId,
      selectorConversationId,
      '[club900001|YSTUty], Помощь',
    );
    await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) =>
        call.params.peer_id === String(selectorPeerId) &&
        String(call.params.message).includes('Краткий гайд'),
    );
    await harness.waitForTransportIdle();

    const textSelectorCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user sends unaddressed group selector text');
    harness.vk.pushChatMessage(
      selectorMemberId,
      selectorConversationId,
      'Выбрать группу',
    );
    await waitForBackgroundUpdate();
    expect(harness.vk.calls.slice(textSelectorCallIndex)).toHaveLength(0);

    const callbackCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ group user presses the real group-selector callback');
    harness.vk.pushChatMessageEvent(
      selectorMemberId,
      selectorConversationId,
      selectorCardCall.result,
      selectorPayload,
    );
    await harness.vk.waitForNextCall<VkEditMessageCall>(
      callbackCallIndex,
      'messages.edit',
      (call) =>
        call.params.peer_id === String(selectorPeerId) &&
        String(call.params.message).includes('Список институтов'),
    );
    e2eTrace('VK', '← group callback opens institutes despite no text appeal');
  });
});
