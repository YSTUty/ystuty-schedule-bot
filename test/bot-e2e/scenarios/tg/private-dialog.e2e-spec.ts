import { SocialType } from '@my-common/constants';
import { LocalePhrase } from '@my-interfaces';

import { e2eTrace } from '../../e2e-trace.util';
import { BotE2eHarness } from '../../harness/bot-e2e-harness';
import { waitForBackgroundUpdate } from '../scenario.util';

import {
  getTgCallbackData,
  getTgReplyKeyboardText,
  hasTgCallback,
  hasTgInlineKeyboard,
  hasTgReplyKeyboard,
} from './tg-scenario.util';
import type {
  TgAnswerCallbackCall,
  TgEditMessageCall,
  TgSendMessageCall,
} from './tg-scenario.util';

type InstituteCallbackData = `pager:glist:${string}`;
type GroupCallbackData = `selectGroup:${string}`;
type ScheduleWeekCallbackData =
  `${LocalePhrase.Button_Schedule_ForWeek}:${string}`;

const student = {
  id: 710001,
  firstName: 'Тестовый Студент',
  username: 'e2e_student',
};

describe('Telegram private dialog (transport E2E)', () => {
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

  it('handles a real polling journey from start to group schedule', async () => {
    e2eTrace('TG', '→ user sends /start');
    harness.telegram.pushText(student, '/start');

    const mainKeyboardCall =
      await harness.telegram.waitForCall<TgSendMessageCall>(
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === student.id &&
          hasTgReplyKeyboard(call.result),
      );
    expect(hasTgReplyKeyboard(mainKeyboardCall.result)).toBe(true);
    e2eTrace('TG', '← received main reply keyboard');

    const selectGroupCardCall =
      await harness.telegram.waitForCall<TgSendMessageCall>(
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === student.id &&
          hasTgCallback(call.result, LocalePhrase.Button_SelectGroup),
      );
    const welcomeMessage = selectGroupCardCall.result;
    e2eTrace('TG', '← received welcome card with “Select group” callback');

    e2eTrace('TG', '→ user presses “Select group”');
    const selectGroupCallIndex = harness.telegram.calls.length;
    const selectGroupCallbackId = harness.telegram.pushCallback(
      student,
      LocalePhrase.Button_SelectGroup,
      welcomeMessage,
    );
    const selectGroupAnswerCall =
      await harness.telegram.waitForNextCall<TgAnswerCallbackCall>(
        selectGroupCallIndex,
        'answerCallbackQuery',
      );
    expect(selectGroupAnswerCall.params.callback_query_id).toBe(
      selectGroupCallbackId,
    );
    const instituteListCall =
      await harness.telegram.waitForCall<TgEditMessageCall>(
        'editMessageText',
        (call) => String(call.params.text).includes('Список институтов'),
      );
    expect(instituteListCall.method).toBe('editMessageText');
    e2eTrace('TG', '← callback card changed to institute list');

    const instituteData = getTgCallbackData<InstituteCallbackData>(
      instituteListCall,
      (data, button): data is InstituteCallbackData =>
        data.startsWith('pager:glist:') &&
        button.text === 'Институт цифровых систем',
    );
    const instituteMessage =
      harness.telegram.getMessageWithCallback(instituteData);
    expect(instituteMessage).toBeDefined();
    e2eTrace('TG', '→ user selects Institute of Digital Systems');
    harness.telegram.pushCallback(student, instituteData, instituteMessage!);

    const groupListCall = await harness.telegram.waitForCall<TgEditMessageCall>(
      'editMessageText',
      (call) => String(call.params.text).includes('Список групп'),
    );
    const groupData = getTgCallbackData<GroupCallbackData>(
      groupListCall,
      (data): data is GroupCallbackData => data.startsWith('selectGroup:'),
    );
    const groupsMessage = harness.telegram.getMessageWithCallback(groupData);
    expect(groupsMessage).toBeDefined();
    e2eTrace('TG', '← callback card changed to group list');
    const groupSelectionCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ user selects group ИВТ-101');
    harness.telegram.pushCallback(student, groupData, groupsMessage!);

    await harness.telegram.waitForCall(
      'sendMessage',
      (call) =>
        Number(call.params.chat_id) === student.id &&
        String(call.params.text).includes('ИВТ-101'),
    );
    // Group selection deletes the old callback card after persisting the
    // profile. Wait for that cleanup before injecting the next polling event.
    await harness.telegram.waitForCall('deleteMessage');
    const updatedMenu = await harness.telegram.waitForNextCall(
      groupSelectionCallIndex,
      'sendMessage',
      (call) => hasTgReplyKeyboard(call.result),
    );
    await waitForBackgroundUpdate();
    const persistedUserSocial = await harness.waitForUserSocial(
      SocialType.Telegram,
      student.id,
      (userSocial) => userSocial.groupName === 'ИВТ-101',
    );
    expect(persistedUserSocial.groupName).toBe('ИВТ-101');
    e2eTrace('TG', '← group was saved and main keyboard was refreshed');

    const dayScheduleCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ user presses “Schedule for group”');
    harness.telegram.pushText(
      student,
      getTgReplyKeyboardText(updatedMenu.result, 'Расписание группы'),
    );
    const dayScheduleCall =
      await harness.telegram.waitForNextCall<TgSendMessageCall>(
        dayScheduleCallIndex,
        'sendMessage',
        (call) => String(call.params.text).includes('E2E текущая неделя'),
      );
    expect(hasTgInlineKeyboard(dayScheduleCall.result)).toBe(true);
    e2eTrace('TG', '← received current-week schedule with inline navigation');

    const weekData = getTgCallbackData<ScheduleWeekCallbackData>(
      dayScheduleCall,
      (data): data is ScheduleWeekCallbackData =>
        data.startsWith(`${LocalePhrase.Button_Schedule_ForWeek}:`),
    );
    const weekScheduleCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ user presses “Schedule for week”');
    // A real callback can outlive its message. The fake server lets this
    // scenario verify the transport fallback instead of silently swallowing
    // Telegram's edit error.
    harness.telegram.failNext('editMessageText', {
      error_code: 400,
      description: 'Bad Request: message to edit not found',
    });
    const weekCallbackId = harness.telegram.pushCallback(
      student,
      weekData,
      dayScheduleCall.result,
    );
    const weekScheduleCall =
      await harness.telegram.waitForNextCall<TgSendMessageCall>(
        weekScheduleCallIndex,
        'sendMessage',
        (call) =>
          String(call.params.text).includes('Расписание на') &&
          String(call.params.text).includes('E2E'),
      );
    expect(hasTgInlineKeyboard(weekScheduleCall.result)).toBe(true);
    const weekAnswerCall =
      await harness.telegram.waitForNextCall<TgAnswerCallbackCall>(
        weekScheduleCallIndex,
        'answerCallbackQuery',
      );
    expect(weekAnswerCall.params.callback_query_id).toBe(weekCallbackId);
    e2eTrace('TG', '← Telegram edit fallback sent the weekly view');
  });

  it('keeps two queued private users and their transport profiles isolated', async () => {
    const firstStudent = { ...student, id: 710011, username: 'e2e_first' };
    const secondStudent = { ...student, id: 710012, username: 'e2e_second' };

    // Two raw updates are placed in the same polling burst. They must get
    // separate Redis sessions and persistent profiles in one Nest process.
    e2eTrace('TG', '→ polling burst: two new users send /start');
    const startedCallIndex = harness.telegram.calls.length;
    harness.telegram.pushText(firstStudent, '/start');
    harness.telegram.pushText(secondStudent, '/start');
    await Promise.all([
      harness.telegram.waitForNextCall<TgSendMessageCall>(
        startedCallIndex,
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === firstStudent.id &&
          hasTgReplyKeyboard(call.result),
      ),
      harness.telegram.waitForNextCall<TgSendMessageCall>(
        startedCallIndex,
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === secondStudent.id &&
          hasTgReplyKeyboard(call.result),
      ),
    ]);
    await waitForBackgroundUpdate();

    await expect(
      harness.getUserSocial(SocialType.Telegram, firstStudent.id),
    ).resolves.toMatchObject({
      username: firstStudent.username,
      hasDM: true,
    });
    await expect(
      harness.getUserSocial(SocialType.Telegram, secondStudent.id),
    ).resolves.toMatchObject({
      username: secondStudent.username,
      hasDM: true,
    });
    e2eTrace('TG', '← burst preserved independent persistent profiles');
  });

  it('serves stale cached schedule when the upstream Schedule API is unavailable', async () => {
    const cacheStudent = { ...student, id: 710021, username: 'e2e_cache' };

    harness.telegram.pushText(cacheStudent, 'группа ИВТ-101');
    await waitForBackgroundUpdate();
    harness.telegram.pushText(cacheStudent, '.');
    await harness.telegram.waitForCall<TgSendMessageCall>(
      'sendMessage',
      (call) =>
        Number(call.params.chat_id) === cacheStudent.id &&
        String(call.params.text).includes('ИВТ-101'),
    );

    harness.telegram.pushText(cacheStudent, 'Расписание');
    await harness.telegram.waitForCall<TgSendMessageCall>(
      'sendMessage',
      (call) =>
        Number(call.params.chat_id) === cacheStudent.id &&
        String(call.params.text).includes('E2E текущая неделя'),
    );
    await harness.ageScheduleCache('group', 'ИВТ-101', 16 * 60 * 1e3);
    const schedulePath = `/v1/schedule/group/${encodeURIComponent('ИВТ-101')}`;
    harness.schedule.failNext(schedulePath, { statusCode: 503 });

    const staleCallIndex = harness.telegram.calls.length;
    e2eTrace('TG', '→ Schedule API returns 503 after cached snapshot ages');
    harness.telegram.pushText(cacheStudent, 'Расписание');
    const staleScheduleCall =
      await harness.telegram.waitForNextCall<TgSendMessageCall>(
        staleCallIndex,
        'sendMessage',
        (call) =>
          Number(call.params.chat_id) === cacheStudent.id &&
          String(call.params.text).includes('E2E текущая неделя'),
      );

    expect(String(staleScheduleCall.params.text)).toContain('♻️');
    expect(harness.schedule.calls).toContainEqual({
      method: 'GET',
      path: schedulePath,
    });
    e2eTrace('TG', '← stale Schedule cache is returned with its marker');
  });
});
