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

type VkGroupListPayload = VkCallbackPayload & { groupAction: 'groups' };
type VkGroupSelectionPayload = VkCallbackPayload & { groupAction: 'select' };
type VkScheduleWeekPayload = VkCallbackPayload & {
  phrase: LocalePhrase.Button_Schedule_ForWeek;
};

describe('VK private dialog (transport E2E)', () => {
  let harness: BotE2eHarness;

  beforeAll(async () => {
    harness = await BotE2eHarness.start();
  }, 30e3);

  afterAll(async () => {
    await harness?.close();
  }, 30e3);

  it('handles a real Bots Long Poll journey from start to group schedule', async () => {
    const vkUserId = 720001;
    e2eTrace('VK', '→ message_new: /start');
    harness.vk.pushMessage(vkUserId, '/start');

    const mainKeyboardCall = await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) =>
        call.params.peer_id === String(vkUserId) && !!call.params.keyboard,
    );
    expect(mainKeyboardCall.params.keyboard).toBeDefined();
    e2eTrace('VK', '← messages.send with main keyboard');

    e2eTrace('VK', '→ message_new: /institutes');
    harness.vk.pushMessage(vkUserId, '/institutes');
    const instituteListCall = await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) => String(call.params.message).includes('Список институтов'),
    );
    const institutePayload = getVkCallbackPayload<VkGroupListPayload>(
      instituteListCall,
      (payload): payload is VkGroupListPayload =>
        payload.groupAction === 'groups',
    );
    e2eTrace('VK', '← messages.send with institute list');
    e2eTrace('VK', '→ message_event: select Institute of Digital Systems');
    harness.vk.pushMessageEvent(
      vkUserId,
      instituteListCall.result,
      institutePayload,
    );

    const groupListCall = await harness.vk.waitForCall<VkEditMessageCall>(
      'messages.edit',
      (call) => String(call.params.message).includes('Список групп'),
    );
    const groupPayload = getVkCallbackPayload<VkGroupSelectionPayload>(
      groupListCall,
      (payload): payload is VkGroupSelectionPayload =>
        payload.groupAction === 'select',
    );
    e2eTrace('VK', '← messages.edit with group list');
    e2eTrace('VK', '→ message_event: select group ИВТ-101');
    harness.vk.pushMessageEvent(
      vkUserId,
      instituteListCall.result,
      groupPayload,
    );

    await harness.vk.waitForCall('messages.edit', (call) =>
      String(call.params.message).includes('ИВТ-101'),
    );
    await waitForBackgroundUpdate();
    e2eTrace('VK', '← messages.edit confirms selected group');

    const dayScheduleCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ message_new: schedule button payload');
    harness.vk.pushMessage(
      vkUserId,
      'Расписание',
      JSON.stringify({ phrase: LocalePhrase.Button_Schedule_Schedule }),
    );
    const dayScheduleCall = await harness.vk.waitForNextCall<VkSendMessageCall>(
      dayScheduleCallIndex,
      'messages.send',
      (call) => String(call.params.message).includes('E2E текущая неделя'),
    );
    expect(dayScheduleCall.params.keyboard).toBeDefined();
    e2eTrace('VK', '← messages.send with current-week schedule');

    const weekPayload = getVkCallbackPayload<VkScheduleWeekPayload>(
      dayScheduleCall,
      (payload): payload is VkScheduleWeekPayload =>
        payload.phrase === LocalePhrase.Button_Schedule_ForWeek,
    );
    const weekScheduleCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ message_event: schedule for week');
    harness.vk.pushMessageEvent(vkUserId, dayScheduleCall.result, weekPayload);
    const weekScheduleCall =
      await harness.vk.waitForNextCall<VkEditMessageCall>(
        weekScheduleCallIndex,
        'messages.edit',
        (call) =>
          String(call.params.message).includes('Расписание на') &&
          String(call.params.message).includes('E2E'),
      );
    expect(weekScheduleCall.params.keyboard).toBeDefined();
    e2eTrace('VK', '← messages.edit changes schedule to weekly view');
  });
});
