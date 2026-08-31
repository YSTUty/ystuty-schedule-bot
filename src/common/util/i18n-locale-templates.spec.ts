import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { resolve } from 'path';

import { patternGroupName } from './schedule.util';
import { i18n as telegramI18n } from './tg/i18n.util';
import { i18n as vkI18n } from './vk/i18n.util';

interface LocaleTree {
  [key: string]: LocaleTree | string;
}

const localeTemplateData = {
  actionButton: true,
  actionButtonsCount: 2,
  actionKeyboardSummary: '• Выбрать группу: «Группа»',
  activityText: 'за последние 30 дней',
  audienceMode: 'manual',
  botName: 'ystuty_schedule_bot',
  campaign: {
    actionKeyboard: [{ type: 'select_group' }],
    audienceFilter: {
      excludeCampaignIds: [12],
      groupName: 'ЦИС-46',
      groupNames: ['ЦИС-46'],
      lastInteractionAfter: '2026-08-01',
      lastInteractionBefore: '2026-08-31',
      onlyAuthorized: true,
    },
    contentPreview: 'Тестовое сообщение',
    createdAt: new Date('2026-08-28T10:00:00Z'),
    failedCount: 1,
    feedbackButton: { text: '🫡' },
    id: 12,
    mode: 'manual',
    sentCount: 9,
    settingsVersion: 1,
    skippedCount: 0,
    totalCount: 10,
  },
  campaignId: 12,
  content: 'Расписание на сегодня',
  currentPage: 1,
  days: 2,
  deletedCount: 8,
  doneCount: 9,
  excludeCampaignIds: [12],
  failedCount: 1,
  feedbackId: 12,
  feedbackAfterClickSummary: 'оставить',
  feedbackButton: { responseText: 'Спасибо!', text: '🫡' },
  forwardKeyboardMessageText: 'Выберите действие:',
  filter: {
    groupNames: ['ЦИС-46'],
    hasDM: true,
    isBlockedBot: false,
    onlyAuthorized: true,
  },
  groupName: 'ЦИС-46',
  groupNames: 'ЦИС-46, ЦИС-47',
  groupsCount: 2,
  groupsText: 'ЦИС-46, ЦИС-47',
  hasActivityFilter: true,
  hasExcludedCampaigns: true,
  hasGroups: true,
  hasRecipientKeyboard: true,
  instituteName: 'Институт цифровых систем',
  isNextWeek: false,
  items: [
    {
      createdAt: new Date('2026-08-28T10:00:00Z'),
      id: 12,
      sentCount: 9,
      status: 'completed',
      totalCount: 10,
    },
  ],
  mode: 'manual',
  nextMode: 'all',
  notif: {
    deliveryHour: 8,
    deliveryMinute: 30,
    isEnabled: true,
    targetDayOffset: 0,
    targetId: 'ЦИС-46',
    weekdaysLabel: 'пн–пт',
  },
  onlyAuthorized: true,
  patternGroupName: '(?<groupName>ЦИС-46)',
  patternGroupName0: '(?<groupName>ЦИС-46)',
  query: 'Иванов',
  randomGroupName: 'ЦИС-46',
  randomGroupName2: 'ЦИС-47',
  recipientsCount: 10,
  remainingCount: 2,
  selected: true,
  selectedCampaignIds: [12],
  selectedCount: 2,
  selectedGroupsCount: 2,
  selectedRecipientIds: [101, 102],
  selectedGroupName: 'ЦИС-46',
  sentCount: 9,
  status: {
    active: 1,
    completed: 9,
    delayed: 0,
    failed: 1,
    paused: 0,
    toString: () => 'completed',
    waiting: 0,
  },
  teacher: { name: 'Иванов И. И.' },
  totalCount: 10,
  totalPages: 3,
  user: {
    fullname: 'Иванов Иван Иванович',
    groupName: 'ЦИС-46',
    isRewoked: false,
    login: 'ivanov',
  },
  useInline: false,
  webViewLink: 'schedule.example',
};

const createTemplateData = (phrase: string, ctx: unknown) =>
  phrase === 'page.broadcast.progress'
    ? {
        campaignId: 12,
        ctx,
        doneCount: 9,
        failedCount: 1,
        sentCount: 9,
        skippedCount: 0,
        status: 'completed',
        totalCount: 10,
      }
    : { ...localeTemplateData, ctx };

const getTemplatePaths = (tree: LocaleTree, path = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (typeof value === 'string') {
      return value.includes('${') ? [nextPath] : [];
    }

    return getTemplatePaths(value, nextPath);
  });

const getTemplatePathsForTransport = (transport: 'telegram' | 'vk') => {
  const path = resolve(__dirname, `../../../locales/${transport}/ru.yaml`);
  const locale = load(readFileSync(path, 'utf8')) as LocaleTree;

  return getTemplatePaths(locale);
};

const getScheduleRegExp = (
  transport: 'telegram' | 'vk',
  period: 'for_one_day' | 'for_week',
) => {
  const path = resolve(__dirname, `../../../locales/${transport}/ru.yaml`);
  const locale = load(readFileSync(path, 'utf8')) as {
    regexp: { schedule: Record<typeof period, string> };
  };
  const source = locale.regexp.schedule[period];
  const [, pattern, flags] = source.match(/^\/(.*)\/([a-z]*)$/i) || [];

  return new RegExp(
    pattern.replace('${patternGroupName}', patternGroupName),
    flags,
  );
};

describe.each([
  [
    'Telegram',
    telegramI18n,
    { chat: { type: 'private' }, userSocial: { groupName: 'ЦИС-46' } },
  ],
  [
    'VK',
    vkI18n,
    {
      isDM: true,
      state: { userSocial: { groupName: 'ЦИС-46' } },
    },
  ],
] as const)('%s locale templates', (_transport, i18n, ctx) => {
  it('renders every string containing a template expression', () => {
    const templatePaths = getTemplatePathsForTransport(
      _transport.toLowerCase() as 'telegram' | 'vk',
    );
    expect(templatePaths.length).toBeGreaterThan(0);

    for (const phrase of templatePaths) {
      const templateData = createTemplateData(phrase, ctx);

      try {
        i18n.t('ru', phrase, templateData);
      } catch (error) {
        throw new Error(
          `Не удалось скомпилировать locale key ${phrase}; status=${String(templateData.status)}`,
          { cause: error },
        );
      }
    }
  });
});

describe.each(['telegram', 'vk'] as const)(
  '%s schedule commands',
  (transport) => {
    it('supports the detailed presentation for days, weeks and explicit groups', () => {
      expect(
        getScheduleRegExp(transport, 'for_one_day').exec('расписание подробно')
          ?.groups?.detailed,
      ).toBe(' подробно');
      expect(
        getScheduleRegExp(transport, 'for_one_day').exec(
          'расписание ЦИС-46 подробно',
        )?.groups,
      ).toMatchObject({ detailed: ' подробно', groupName: 'ЦИС-46' });
      expect(
        getScheduleRegExp(transport, 'for_week').exec(
          'расписание на неделю подробно',
        )?.groups?.detailed,
      ).toBe(' подробно');
    });
  },
);
