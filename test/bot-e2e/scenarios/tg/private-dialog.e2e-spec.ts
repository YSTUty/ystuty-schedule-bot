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
import type { TgEditMessageCall, TgSendMessageCall } from './tg-scenario.util';

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
    harness.telegram.pushCallback(
      student,
      LocalePhrase.Button_SelectGroup,
      welcomeMessage,
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
    harness.telegram.pushCallback(student, weekData, dayScheduleCall.result);
    const weekScheduleCall =
      await harness.telegram.waitForNextCall<TgEditMessageCall>(
        weekScheduleCallIndex,
        'editMessageText',
        (call) =>
          String(call.params.text).includes('Расписание на') &&
          String(call.params.text).includes('E2E'),
      );
    expect(hasTgInlineKeyboard(weekScheduleCall.result)).toBe(true);
    e2eTrace('TG', '← schedule message changed to weekly view');
  });
});
