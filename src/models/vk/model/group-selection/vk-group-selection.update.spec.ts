import { ListenerDecorator, matchMessageEventPayload } from 'nestjs-vk';

import { LocalePhrase } from '@my-interfaces';

import { VkGroupSelectionUpdate } from './vk-group-selection.update';

const getMessageEventCondition = (methodName: string) => {
  const method = (
    VkGroupSelectionUpdate.prototype as unknown as Record<string, object>
  )[methodName];
  const listeners = Reflect.getMetadata(ListenerDecorator.KEY, method) as {
    handlerType: string;
    event: unknown;
  }[];

  return listeners.find((listener) => listener.handlerType === 'message_event')
    ?.event;
};

describe('VkGroupSelectionUpdate', () => {
  const createUpdate = () => {
    const keyboardFactory = { getInstitutesListButton: jest.fn() };
    const groupPicker = {
      renderInstitutes: jest.fn(),
      renderGroups: jest.fn(),
    };
    const scheduleService = {
      groupsInstitutesList: jest.fn(),
      groupsList: jest.fn(),
      instituteNameByHash: jest.fn(),
    };

    return {
      update: new VkGroupSelectionUpdate(
        scheduleService as any,
        keyboardFactory as any,
        groupPicker as any,
        {} as any,
      ),
      groupPicker,
    };
  };

  it('registers each group callback action with its own payload condition', () => {
    expect(getMessageEventCondition('onGroupInstitutes')).toEqual({
      groupAction: 'institutes',
    });
    expect(getMessageEventCondition('onGroupList')).toEqual({
      groupAction: 'groups',
    });
    expect(getMessageEventCondition('onGroupSelect')).toEqual({
      groupAction: 'select',
    });
    expect(getMessageEventCondition('onOpenGroupSelect')).toEqual({
      phrase: LocalePhrase.Button_SelectGroup,
    });
  });

  it.each([
    [
      'onGroupInstitutes',
      { groupAction: 'institutes' },
      { groupAction: 'groups' },
    ],
    ['onGroupList', { groupAction: 'groups' }, { groupAction: 'select' }],
    ['onGroupSelect', { groupAction: 'select' }, { groupAction: 'groups' }],
    [
      'onOpenGroupSelect',
      { phrase: LocalePhrase.Button_SelectGroup },
      { phrase: LocalePhrase.Button_Schedule_Teacher },
    ],
  ])(
    'routes %s only to its matching message-event payload',
    (methodName, matchingPayload, foreignPayload) => {
      const condition = getMessageEventCondition(methodName);

      expect(
        matchMessageEventPayload(matchingPayload, condition as any, {} as any),
      ).toBe(true);
      expect(
        matchMessageEventPayload(foreignPayload, condition as any, {} as any),
      ).toBe(false);
    },
  );

  it('opens institutes from the generic VK group selection callback', async () => {
    const { update } = createUpdate();
    const renderInstitutesList = jest
      .spyOn(update as any, 'renderInstitutesList')
      .mockResolvedValue(undefined);
    const ctx = { eventPayload: { phrase: LocalePhrase.Button_SelectGroup } };

    try {
      await update.onOpenGroupSelect(ctx as any);

      expect(renderInstitutesList).toHaveBeenCalledWith(ctx);
    } finally {
      renderInstitutesList.mockRestore();
    }
  });

  it('uses the shared picker with the original VK institute page budget', async () => {
    const { update, groupPicker } = createUpdate();
    groupPicker.renderInstitutes.mockReturnValue({
      text: 'Институты',
      keyboard: { inline: jest.fn().mockReturnValue('keyboard') },
    });
    const ctx = {
      isMessageEventContext: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    } as any;

    await update.onInstitutesList(ctx);

    expect(groupPicker.renderInstitutes).toHaveBeenCalledWith(
      ctx,
      1,
      expect.objectContaining({ pagerMode: 'edges' }),
      5,
    );
    expect(ctx.send).toHaveBeenCalledWith('Институты', {
      keyboard: 'keyboard',
    });
  });

  it('opens institutes instead of the VK scene for a targetless selection request', async () => {
    const { update } = createUpdate();
    const renderInstitutesList = jest
      .spyOn(update as any, 'renderInstitutesList')
      .mockResolvedValue(undefined);
    const scene = { enter: jest.fn() };
    const ctx = {
      isChat: false,
      state: {},
      $match: { groups: {} },
      scene,
    } as any;

    try {
      await update.hearSelectGroup(ctx);

      expect(renderInstitutesList).toHaveBeenCalledWith(ctx);
      expect(scene.enter).not.toHaveBeenCalled();
    } finally {
      renderInstitutesList.mockRestore();
    }
  });
});
