import { VkRichTextDebugUpdate } from './vk-rich-text-debug.update';

describe('VkRichTextDebugUpdate', () => {
  const sendMessageHtml = jest.fn();
  const update = new VkRichTextDebugUpdate({ sendMessageHtml } as any);

  beforeEach(() => {
    sendMessageHtml.mockReset().mockResolvedValue(1);
  });

  it('keeps the debug command in administrator private messages', async () => {
    const ctx = {
      isDM: true,
      peerId: 10,
      senderId: 10,
      $groupId: 42,
      $match: { groups: { variant: 'mentions' } },
      send: jest.fn(),
    } as any;

    await update.onDebugRichText(ctx);

    expect(sendMessageHtml).toHaveBeenCalledTimes(4);
    expect(sendMessageHtml).toHaveBeenCalledWith(
      10,
      expect.stringContaining('[id10|Администратор]'),
    );
    expect(sendMessageHtml).toHaveBeenCalledWith(
      10,
      expect.stringContaining('[club42|Сообщество]'),
    );
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('does not send formatting samples into a group chat', async () => {
    const ctx = {
      isDM: false,
      $match: { groups: { variant: 'basic' } },
      send: jest.fn().mockResolvedValue(undefined),
    } as any;

    await update.onDebugRichText(ctx);

    expect(sendMessageHtml).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(
      'Проверка форматирования доступна только в личных сообщениях.',
    );
  });
});
