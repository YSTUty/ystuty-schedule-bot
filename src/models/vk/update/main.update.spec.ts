import { ListenerDecorator } from 'nestjs-vk';

import { MainUpdate } from './main.update';

describe('VK MainUpdate', () => {
  const keyboardFactory = {} as any;
  const update = new MainUpdate(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    keyboardFactory,
    {} as any,
  );

  it('registers the help callback in the main transport update', () => {
    const listeners = Reflect.getMetadata(
      ListenerDecorator.KEY,
      MainUpdate.prototype.onHelpMessageEvent,
    ) as { handlerType: string; event: unknown }[];

    expect(listeners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handlerType: 'message_event',
          event: { mainAction: 'help' },
        }),
      ]),
    );
  });

  it('acknowledges the inline help button before showing help', async () => {
    keyboardFactory.getStart = jest
      .fn()
      .mockReturnValue({ inline: jest.fn().mockReturnValue('start') });
    keyboardFactory.needInline = jest.fn().mockReturnValue(false);
    const ctx = {
      isDM: true,
      state: {},
      i18n: { t: jest.fn().mockReturnValue('Помощь') },
      answer: jest.fn(),
      send: jest.fn(),
    } as any;

    await update.onHelpMessageEvent(ctx);

    expect(ctx.answer).toHaveBeenCalledWith({
      type: 'show_snackbar',
      text: 'Открываю справку',
    });
    expect(ctx.send).toHaveBeenCalledWith('Помощь', { keyboard: 'start' });
  });

  it('marks the conversation as left when the bot is kicked from a VK chat', async () => {
    const conversation = { isLeaved: false };

    await update.onChatKickUser({
      $groupId: 42,
      eventMemberId: -42,
      state: { conversation },
    } as any);

    expect(conversation.isLeaved).toBe(true);
  });
});
