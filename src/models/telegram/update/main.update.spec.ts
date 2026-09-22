import { LocalePhrase } from '@my-interfaces';

import { MainUpdate } from './main.update';

describe('Telegram MainUpdate', () => {
  const keyboardFactory = {} as any;
  const scheduleKeyboardFactory = {} as any;
  const telegramService = {} as any;
  const update = new MainUpdate(
    keyboardFactory,
    scheduleKeyboardFactory,
    {} as any,
    {} as any,
    telegramService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('renders the invite keyboard', async () => {
    const keyboard = { reply_markup: { inline_keyboard: [] } };
    keyboardFactory.getInviteToChat = jest.fn().mockReturnValue(keyboard);
    const ctx = { replyWithHTML: jest.fn() } as any;

    await update.onInvite(ctx);

    expect(ctx.replyWithHTML).toHaveBeenCalledWith(
      'Пригласить бота в группу:',
      keyboard,
    );
  });

  it('acknowledges the inline help button before showing help', async () => {
    const keyboard = { reply_markup: { keyboard: [] } };
    keyboardFactory.getStart = jest.fn().mockReturnValue(keyboard);
    const ctx = {
      updateType: 'callback_query',
      chat: { type: 'private' },
      state: {},
      i18n: { t: jest.fn().mockReturnValue('Помощь') },
      tryAnswerCbQuery: jest.fn(),
      replyWithHTML: jest.fn(),
    } as any;

    await update.hearHelp(ctx);

    expect(ctx.tryAnswerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.replyWithHTML).toHaveBeenCalledWith('Помощь', keyboard);
  });

  it('sends a feature card after the start message in a private chat', async () => {
    const startKeyboard = { reply_markup: { keyboard: [] } };
    const welcomeKeyboard = { reply_markup: { inline_keyboard: [] } };
    keyboardFactory.getStart = jest.fn().mockReturnValue(startKeyboard);
    keyboardFactory.getWelcomeFeatures = jest
      .fn()
      .mockReturnValue(welcomeKeyboard);
    telegramService.syncPrivateChatCommands = jest.fn();
    telegramService.isAdmin = jest.fn().mockReturnValue(false);
    const ctx = {
      chat: { id: 7, type: 'private' },
      from: { id: 9 },
      message: { text: '/start' },
      session: {},
      user: { id: 1 },
      userSocial: { groupName: 'ЦИС-11' },
      i18n: { t: jest.fn((phrase) => phrase) },
      replyWithHTML: jest.fn(),
    } as any;

    await update.hearStart(ctx);

    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      1,
      LocalePhrase.Page_Start,
      startKeyboard,
    );
    expect(ctx.replyWithHTML).toHaveBeenNthCalledWith(
      2,
      LocalePhrase.Page_WelcomeFeatures,
      welcomeKeyboard,
    );
  });

  it('updates conversation membership only for the bot', async () => {
    const conversation = { isLeaved: false };

    await update.onMyChatMember({
      botInfo: { id: 42 },
      userSocial: { id: 1 },
      conversation,
      myChatMember: {
        chat: { type: 'group', title: 'Расписание' },
        old_chat_member: { status: 'member' },
        new_chat_member: { status: 'kicked', user: { id: 42 } },
      },
    } as any);

    expect(conversation.isLeaved).toBe(true);
  });
});
