import * as http from 'node:http';

import { LessonFlags, type OneWeek, WeekNumberType } from '@my-interfaces';

import {
  getScheduleAcademicWeekNumber,
  getScheduleTargetDate,
  getScheduleWeekStartDate,
} from '../../../src/models/schedule/util/schedule.util';

import {
  closeHttpServer,
  listenHttpServer,
  sendJson,
} from './http-server.util';

const GROUPS = [
  {
    id: 1,
    name: 'Институт цифровых систем',
    groups: ['ИВТ-101', 'ИВТ-102'],
  },
  {
    id: 2,
    name: 'Институт экономики',
    groups: ['ЭК-201', 'ЭК-202'],
  },
];

const TEACHERS = [
  { id: 101, name: 'Иванов Иван Иванович' },
  { id: 102, name: 'Петрова Анна Сергеевна' },
];

const cacheMetadata = { isCache: false, cache: { isCached: false } };

/** Стабильный HTTP-адаптер Schedule API для transport E2E без внешней сети. */
export class FakeScheduleApi {
  private readonly server: http.Server;

  public url = '';

  private constructor() {
    this.server = http.createServer((request, response) => {
      const path = new URL(request.url || '/', 'http://e2e.local').pathname;

      if (request.method !== 'GET') {
        sendJson(response, { error: 'Method not allowed' }, 405);
        return;
      }

      if (path === '/v1/schedule/actual_groups') {
        sendJson(response, { ...cacheMetadata, items: GROUPS });
        return;
      }
      if (path === '/v1/schedule/actual_teachers') {
        sendJson(response, {
          ...cacheMetadata,
          items: TEACHERS,
          count: TEACHERS.length,
        });
        return;
      }
      if (path === '/v1/schedule/count') {
        sendJson(response, {
          ...cacheMetadata,
          institutes: GROUPS.length,
          groups: GROUPS.flatMap((institute) => institute.groups).length,
          teachers: TEACHERS.length,
          audiences: 0,
        });
        return;
      }
      if (path.startsWith('/v1/schedule/group/')) {
        sendJson(response, { ...cacheMetadata, items: createWeeks() });
        return;
      }
      if (path.startsWith('/v1/schedule/teacher/')) {
        sendJson(response, {
          ...cacheMetadata,
          items: createWeeks(),
          teacher: TEACHERS[0],
        });
        return;
      }

      sendJson(
        response,
        { error: `Unknown fake Schedule API route: ${path}` },
        404,
      );
    });
  }

  public static async start() {
    const api = new FakeScheduleApi();
    api.url = await listenHttpServer(api.server);
    return api;
  }

  public async close() {
    await closeHttpServer(this.server);
  }
}

/** Возвращает текущую и следующую учебные недели, чтобы fixture не старела по календарю. */
const createWeeks = (): OneWeek[] => {
  const today = getScheduleTargetDate();
  const nextWeekDate = new Date(today);
  nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);

  return [
    createWeek(today, 'E2E текущая неделя'),
    createWeek(nextWeekDate, 'E2E следующая неделя'),
  ];
};

const createWeek = (date: Date, lessonName: string): OneWeek => {
  const weekStart = getScheduleWeekStartDate(date);
  const dayNumber = ((date.getUTCDay() || 7) - 1) as WeekNumberType;

  return {
    number: getScheduleAcademicWeekNumber(date),
    days: [
      {
        info: {
          type: dayNumber,
          date: date.toISOString(),
          weekNumber: getScheduleAcademicWeekNumber(date),
        },
        lessons: [
          {
            number: 2,
            timeRange: '10:10-11:40',
            originalTimeTitle: '2. 10:10-11:40',
            parity: 0,
            lessonName,
            type: LessonFlags.Practical,
            isStream: false,
            duration: 2,
            durationMinutes: 90,
            isDivision: false,
            auditoryName: 'А-101',
            teacherName: TEACHERS[0].name,
            teacherId: TEACHERS[0].id,
          },
        ],
      },
      // Monday keeps week start visible in the result even when the test runs on Sunday.
      ...(dayNumber === WeekNumberType.Monday
        ? []
        : [
            {
              info: {
                type: WeekNumberType.Monday,
                date: weekStart.toISOString(),
                weekNumber: getScheduleAcademicWeekNumber(date),
              },
              lessons: [],
            },
          ]),
    ],
  };
};
