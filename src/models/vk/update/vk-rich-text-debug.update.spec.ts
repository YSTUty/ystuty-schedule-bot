import { VkRichTextDebugUpdate } from './vk-rich-text-debug.update';

describe('VkRichTextDebugUpdate', () => {
  const sendMessageHtml = jest.fn();
  const sendMessageFormatData = jest.fn();
  const update = new VkRichTextDebugUpdate({
    sendMessageHtml,
    sendMessageFormatData,
  } as any);

  beforeEach(() => {
    sendMessageHtml.mockReset().mockResolvedValue(1);
    sendMessageFormatData.mockReset().mockResolvedValue(1);
  });

  it('uses markdown-to-vk output only through the confirmed format_data sender', async () => {
    const ctx = {
      isDM: true,
      peerId: 10,
      senderId: 10,
      $match: { groups: { variant: 'markdown' } },
      send: jest.fn(),
    } as any;

    jest.useFakeTimers();
    try {
      const processing = update.onDebugRichText(ctx);
      await jest.runAllTimersAsync();
      await processing;
    } finally {
      jest.useRealTimers();
    }

    expect(sendMessageHtml).not.toHaveBeenCalled();
    expect(sendMessageFormatData).toHaveBeenCalledTimes(12);
    expect(sendMessageFormatData).toHaveBeenCalledWith(
      10,
      expect.stringContaining('Markdown: жирный текст'),
      expect.arrayContaining([expect.objectContaining({ type: 'bold' })]),
    );
    expect(sendMessageFormatData).toHaveBeenCalledWith(
      10,
      expect.stringContaining('Markdown: ссылка на YSTUty'),
      expect.arrayContaining([expect.objectContaining({ type: 'url' })]),
    );
  });

  it('renders the full markdown compatibility sample in one message chunk', async () => {
    const ctx = {
      isDM: true,
      peerId: 10,
      senderId: 10,
      $match: { groups: { variant: 'markdown_full' } },
      send: jest.fn(),
    } as any;

    jest.useFakeTimers();
    try {
      const processing = update.onDebugRichText(ctx);
      await jest.runAllTimersAsync();
      await processing;
    } finally {
      jest.useRealTimers();
    }

    expect(sendMessageHtml).not.toHaveBeenCalled();
    expect(sendMessageFormatData).toHaveBeenCalledTimes(1);
    expect(sendMessageFormatData).toHaveBeenCalledWith(
      10,
      expect.stringContaining('БОЛЬШОЙ MARKDOWN → VK'),
      expect.arrayContaining([
        expect.objectContaining({ type: 'bold' }),
        expect.objectContaining({ type: 'italic' }),
        expect.objectContaining({ type: 'url' }),
      ]),
    );
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
