import { LocalePhrase } from '@my-interfaces';

import { TgGroupSelectionUpdate } from './tg-group-selection.update';

describe('TgGroupSelectionUpdate', () => {
  const createUpdate = () => {
    const keyboardFactory = {
      getAllGroupsListButton: jest.fn(() => ({
        callback_data: 'pager:glist',
        text: LocalePhrase.Button_Groups_ListGroups,
      })),
      getInstitutesListButton: jest.fn(),
    };
    const groupPicker = {
      renderInstitutes: jest.fn(() => ({ text: 'Институты', keyboard: {} })),
      renderGroups: jest.fn(() => ({ text: 'Группы', keyboard: {} })),
    };
    const scheduleService = {
      groupNameByHash: jest.fn(),
    };

    return {
      update: new TgGroupSelectionUpdate(
        keyboardFactory as any,
        groupPicker as any,
        scheduleService as any,
        {} as any,
      ),
      keyboardFactory,
      groupPicker,
      scheduleService,
    };
  };

  it('opens group selection from a group-chat callback made by the bot inviter', async () => {
    const { update } = createUpdate();
    const scene = { enter: jest.fn() };
    const ctx = {
      from: { id: 7 },
      chat: { id: -1001, type: 'group' },
      state: { appeal: false },
      conversation: { invitedByUserSocialId: 3 },
      userSocial: { id: 3 },
      match: { groups: { groupName: 'ЦИС-17' } },
      callbackQuery: { data: 'selectGroup:ЦИС-17' },
      scene,
      tryAnswerCbQuery: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    await update.hearSelectGroup(ctx);

    expect(scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE', {
      groupName: 'ЦИС-17',
    });
    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.deleteMessage).toHaveBeenCalledTimes(1);
  });

  it('resolves a compact group callback before opening the selector', async () => {
    const { update, scheduleService } = createUpdate();
    scheduleService.groupNameByHash.mockReturnValue(
      'Длинное название учебной группы',
    );
    const scene = { enter: jest.fn() };
    const ctx = {
      from: { id: 7 },
      chat: { type: 'private' },
      state: {},
      userSocial: { id: 3 },
      match: { groups: { groupName: '0123456789ab' } },
      callbackQuery: { data: 'selectGroup:0123456789ab' },
      scene,
      tryAnswerCbQuery: jest.fn(),
      deleteMessage: jest.fn(),
    } as any;

    await update.hearSelectGroup(ctx);

    expect(scheduleService.groupNameByHash).toHaveBeenCalledWith(
      '0123456789ab',
    );
    expect(scene.enter).toHaveBeenCalledWith('SELECT_GROUP_SCENE', {
      groupName: 'Длинное название учебной группы',
    });
  });

  it('acknowledges an institute-list callback before editing its message', async () => {
    const { update } = createUpdate();
    const calls: string[] = [];
    const ctx = {
      updateType: 'callback_query',
      callbackQuery: { data: 'pager:inst-list' },
      match: { groups: {} },
      i18n: { t: jest.fn((phrase) => phrase) },
      tryAnswerCbQuery: jest.fn(async () => calls.push('answer')),
      editMessageText: jest.fn(async () => calls.push('edit')),
    } as any;

    await update.onInstitutesList(ctx);

    expect(calls).toEqual(['answer', 'edit']);
  });

  it('opens institutes instead of the scene for a targetless selection request', async () => {
    const { update } = createUpdate();
    const onInstitutesList = jest
      .spyOn(update, 'onInstitutesList')
      .mockResolvedValue(undefined);
    const scene = { enter: jest.fn() };
    const ctx = {
      chat: { type: 'private' },
      state: {},
      userSocial: {},
      match: { groups: {} },
      scene,
    } as any;

    try {
      await update.hearSelectGroup(ctx);

      expect(onInstitutesList).toHaveBeenCalledWith(ctx);
      expect(scene.enter).not.toHaveBeenCalled();
    } finally {
      onInstitutesList.mockRestore();
    }
  });

  it('adds an all-groups callback below the Telegram institute list', async () => {
    const { update, groupPicker } = createUpdate();
    const ctx = {
      updateType: 'message',
      message: { text: '/institutes' },
      state: {},
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    } as any;

    await update.onInstitutesList(ctx);

    expect(groupPicker.renderInstitutes).toHaveBeenCalledWith(
      ctx,
      1,
      expect.objectContaining({
        additionalButtons: [
          [
            expect.objectContaining({
              callback_data: 'pager:glist',
              text: LocalePhrase.Button_Groups_ListGroups,
            }),
          ],
        ],
      }),
      26,
    );
  });
});
