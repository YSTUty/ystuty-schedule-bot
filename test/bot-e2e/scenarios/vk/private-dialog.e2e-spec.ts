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

  beforeEach(async () => {
    await harness.resetScenario();
  });

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
    const selectedUserSocial = await harness.waitForUserSocial(
      SocialType.Vkontakte,
      vkUserId,
      (userSocial) => userSocial.groupName === 'ИВТ-101',
    );
    expect(selectedUserSocial.groupName).toBe('ИВТ-101');
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

  it('sends a new schedule message when VK refuses to edit an inline callback', async () => {
    const vkUserId = 720002;
    e2eTrace('VK', '→ message_new: /start for edit fallback');
    harness.vk.pushMessage(vkUserId, '/start');
    await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) => call.params.peer_id === String(vkUserId),
    );

    const scheduleRequestCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ message_new: explicit group schedule');
    harness.vk.pushMessage(vkUserId, 'Расписание ИВТ-101');
    const scheduleCall = await harness.vk.waitForNextCall<VkSendMessageCall>(
      scheduleRequestCallIndex,
      'messages.send',
      (call) => String(call.params.message).includes('E2E текущая неделя'),
    );
    const weekPayload = getVkCallbackPayload<VkScheduleWeekPayload>(
      scheduleCall,
      (payload): payload is VkScheduleWeekPayload =>
        payload.phrase === LocalePhrase.Button_Schedule_ForWeek,
    );

    // `tryEditOrSendMessage()` must keep callback navigation useful for an
    // old or otherwise non-editable message. The fake API lets this branch
    // run through the actual vk-io HTTP client rather than a service mock.
    harness.vk.failNext('messages.edit', {
      error_code: 100,
      error_msg: 'One of the parameters specified was missing or invalid',
    });
    const callbackCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ message_event: schedule week with failed edit');
    harness.vk.pushMessageEvent(vkUserId, scheduleCall.result, weekPayload);

    await harness.vk.waitForNextCall<VkEditMessageCall>(
      callbackCallIndex,
      'messages.edit',
    );
    const fallbackScheduleCall =
      await harness.vk.waitForNextCall<VkSendMessageCall>(
        callbackCallIndex,
        'messages.send',
        (call) => String(call.params.message).includes('Расписание на'),
      );
    expect(fallbackScheduleCall.params.keyboard).toBeDefined();
    e2eTrace('VK', '← messages.send falls back after messages.edit error');
  });

  it('keeps two raw Long Poll messages and their persistent profiles isolated', async () => {
    const firstUserId = 720011;
    const secondUserId = 720012;
    const startedCallIndex = harness.vk.calls.length;

    // Оба события попадают в один ответ Bots Long Poll. Проверяем не только
    // исходящие сообщения, но и то, что middleware не смешал profile state.
    e2eTrace('VK', '→ Long Poll burst: two new users send /start');
    harness.vk.pushMessage(firstUserId, '/start');
    harness.vk.pushMessage(secondUserId, '/start');
    await Promise.all([
      harness.vk.waitForNextCall<VkSendMessageCall>(
        startedCallIndex,
        'messages.send',
        (call) => call.params.peer_id === String(firstUserId),
      ),
      harness.vk.waitForNextCall<VkSendMessageCall>(
        startedCallIndex,
        'messages.send',
        (call) => call.params.peer_id === String(secondUserId),
      ),
    ]);

    await Promise.all([
      harness.waitForUserSocial(SocialType.Vkontakte, firstUserId, (profile) =>
        Boolean(profile.hasDM),
      ),
      harness.waitForUserSocial(SocialType.Vkontakte, secondUserId, (profile) =>
        Boolean(profile.hasDM),
      ),
    ]);
    e2eTrace('VK', '← burst preserved two independent VK profiles');
  });

  it('persists VK permission subscription changes without producing a reply', async () => {
    const vkUserId = 720021;

    e2eTrace('VK', '→ message_allow: user enables personal messages');
    const allowCallIndex = harness.vk.calls.length;
    harness.vk.pushMessageAllow(vkUserId);
    const allowedProfile = await harness.waitForUserSocial(
      SocialType.Vkontakte,
      vkUserId,
      (profile) => profile.hasDM === true,
    );
    expect(allowedProfile.hasDM).toBe(true);
    expect(harness.vk.calls.slice(allowCallIndex)).not.toContainEqual(
      expect.objectContaining({
        method: 'messages.send',
        params: expect.objectContaining({ peer_id: String(vkUserId) }),
      }),
    );

    e2eTrace('VK', '→ message_deny: user disables personal messages');
    const denyCallIndex = harness.vk.calls.length;
    harness.vk.pushMessageDeny(vkUserId);
    const deniedProfile = await harness.waitForUserSocial(
      SocialType.Vkontakte,
      vkUserId,
      (profile) => profile.hasDM === false,
    );
    expect(deniedProfile.hasDM).toBe(false);
    expect(harness.vk.calls.slice(denyCallIndex)).not.toContainEqual(
      expect.objectContaining({
        method: 'messages.send',
        params: expect.objectContaining({ peer_id: String(vkUserId) }),
      }),
    );
    e2eTrace('VK', '← subscription state was persisted without a bot reply');
  });

  it('serves stale cached schedule when the upstream Schedule API is unavailable', async () => {
    const vkUserId = 720031;

    harness.vk.pushMessage(vkUserId, 'группа ИВТ-101');
    await harness.vk.waitForCall<VkSendMessageCall>(
      'messages.send',
      (call) =>
        call.params.peer_id === String(vkUserId) &&
        String(call.params.message).includes('ИВТ-101'),
    );

    const freshScheduleCallIndex = harness.vk.calls.length;
    harness.vk.pushMessage(vkUserId, 'Расписание');
    await harness.vk.waitForNextCall<VkSendMessageCall>(
      freshScheduleCallIndex,
      'messages.send',
      (call) => String(call.params.message).includes('E2E текущая неделя'),
    );
    await harness.ageScheduleCache('group', 'ИВТ-101', 16 * 60 * 1e3);
    const schedulePath = `/v1/schedule/group/${encodeURIComponent('ИВТ-101')}`;
    harness.schedule.failNext(schedulePath, { statusCode: 503 });

    const staleScheduleCallIndex = harness.vk.calls.length;
    e2eTrace('VK', '→ Schedule API returns 503 after cached snapshot ages');
    harness.vk.pushMessage(vkUserId, 'Расписание');
    const staleScheduleCall =
      await harness.vk.waitForNextCall<VkSendMessageCall>(
        staleScheduleCallIndex,
        'messages.send',
        (call) => String(call.params.message).includes('E2E текущая неделя'),
      );

    expect(String(staleScheduleCall.params.message)).toContain('♻️');
    expect(harness.schedule.calls).toContainEqual({
      method: 'GET',
      path: schedulePath,
    });
    e2eTrace('VK', '← stale Schedule cache is returned with its marker');
  });
});
