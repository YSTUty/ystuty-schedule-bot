import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

import { Lesson, LessonFlags, OneWeek, WeekNumberType } from '@my-interfaces';
import { getLessonTypeStrArr, matchGroupName, md5 } from '@my-common';

import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import * as scheduleUtil from './util/schedule.util';

@Injectable()
export class YSTUtyService implements OnModuleInit {
  private readonly logger = new Logger(YSTUtyService.name);
  protected allowCaching = true;

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
  ) {}

  private allGroupsList: {
    name: string;
    groups: string[];
  }[] = [];
  private allTeachersList: {
    id: number;
    name: string;
  }[] = [];

  async onModuleInit() {
    this.logger.debug('Start load all groups & teachers');
    await Promise.all([this.loadAllGroups(), this.loadAllTeachers()]);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  protected onLoadData() {
    this.loadAllGroups().then();
    this.loadAllTeachers().then();
  }

  protected async loadAllGroups() {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{
          name: string;
          items: {
            name: string;
            groups: string[];
          }[];
        }>('/v1/schedule/actual_groups'),
      );

      if (!Array.isArray(data.items)) {
        this.logger.warn('YSTU institutes&groups NOT loaded');
        return null;
      }

      this.allGroupsList = data.items.filter(Boolean);
      this.logger.log(
        `YSTU institutes&groups loaded: (${
          data.items.length
        }/${data.items.reduce((a, b) => a + b.groups.length, 0)})`,
      );
      return true;
    } catch (error) {
      console.log('[loadAllGroups] Error', error.message);
    }

    return false;
  }

  protected async loadAllTeachers() {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{
          isCache: boolean;
          items: {
            id: number;
            name: string;
          }[];
        }>('/v1/schedule/actual_teachers'),
      );

      if (!Array.isArray(data.items)) {
        this.logger.warn('YSTU teachers NOT loaded');
        return null;
      }

      this.allTeachersList = data.items.filter(Boolean);
      this.logger.log(`YSTU teachers loaded: (${data.items.length})`);
      return true;
    } catch (error) {
      console.log('[loadAllTeachers] Error', error.message);
    }

    return false;
  }

  public getGroupByName(groupName?: string) {
    const parse = (str: string) =>
      str
        .trim()
        .toLowerCase()
        .replace(/[\)\(\s\-]/g, '');

    return (
      groupName && this.groupNames.find((e) => parse(e) === parse(groupName))
    );
  }

  public parseGroupName(str: string) {
    const match = matchGroupName(str, 'gi');
    if (!match) {
      return false;
    }

    for (const name of match) {
      const groupName = this.getGroupByName(name);
      if (groupName) {
        return groupName;
      }
    }

    return false;
  }

  public get randomGroupName() {
    const names = this.groupNames;
    return names[Math.floor(Math.random() * names.length)] || '-';
  }

  public get groupNames() {
    return this.allGroupsList.flatMap((e) => e.groups);
  }

  public instituteNameByMD5(nameMD5: string) {
    const name = this.allGroupsList.find((e) => md5(e.name) === nameMD5)?.name;
    return name;
  }

  public groupsList(page = 1, count = 20, instituteNameMD5?: string) {
    // const { groupNames } = this;
    const groupNames = this.allGroupsList
      .filter((e) => !instituteNameMD5 || md5(e.name) === instituteNameMD5)
      .flatMap((e) => e.groups);

    const totalCount = groupNames.length;
    const totalPageCount = page * count;
    const items = groupNames.slice(totalPageCount - count, totalPageCount);

    return {
      items,
      currentPage: page,
      totalPages: Math.ceil(totalCount / count),
    };
  }

  public groupsInstitutesList(page = 1, count = 20) {
    const { allGroupsList } = this;
    const totalCount = allGroupsList.length;
    const totalPageCount = page * count;
    const items = allGroupsList
      .slice(totalPageCount - count, totalPageCount)
      .map((e) => e.name);

    return {
      items,
      currentPage: page,
      totalPages: Math.ceil(totalCount / count),
    };
  }

  public get teacherNames() {
    return this.allTeachersList.map((e) => e.name);
  }

  public getTeacherName(id: number) {
    return this.allTeachersList.find((e) => e.id === id)?.name;
  }

  public async teachersList(page = 1, count = 20) {
    const teachers = this.allTeachersList;
    const totalCount = teachers.length;
    const totalPageCount = page * count;
    const items = teachers.slice(totalPageCount - count, totalPageCount);

    return {
      items,
      currentPage: page,
      totalPages: Math.ceil(totalCount / count),
    };
  }

  public async findNext({
    skipDays = 0,
    isWeek = false,
    weekNumber = WeekNumberType.Monday,
    withTags = false,
    ...targetRest
  }: (
    | { groupName: string }
    | { teacherId: number }
    | { targetId: string | number; targetType: 'group' | 'teacher' }
  ) & {
    skipDays?: number;
    isWeek?: boolean;
    weekNumber?: WeekNumberType;
    withTags?: boolean;
  }) {
    const targetId =
      'targetId' in targetRest
        ? targetRest.targetId
        : 'groupName' in targetRest
          ? targetRest.groupName
          : targetRest.teacherId;
    const targetType =
      'targetType' in targetRest
        ? targetRest.targetType
        : 'groupName' in targetRest
          ? 'group'
          : 'teacher';

    this.metricsService.scheduleCounter.inc({
      [targetType === 'group' ? 'groupName' : 'teacherId']: targetId,
    });

    const findDeep = async (
      skipDays?: number,
      weekNumber?: WeekNumberType,
      isWeek?: boolean,
      next?: boolean,
    ): Promise<[number, string | false]> => {
      const responseSchedule = await this.getFormatedSchedule({
        targetType,
        targetId,
        skipDays,
        isWeek,
        withTags,
      });
      if (responseSchedule !== null || isWeek) {
        return [skipDays, responseSchedule];
      }
      if (weekNumber < WeekNumberType.Sunday) {
        const [_skipDays, nextSchedule] = await findDeep(
          skipDays + 1,
          weekNumber + 1,
          false,
          true,
        );

        if (next || nextSchedule) {
          return [_skipDays, nextSchedule];
        }
      }
      return [skipDays, false];
    };

    return await findDeep(skipDays, weekNumber, isWeek);
  }

  public async getFormatedSchedule({
    skipDays = 0,
    isWeek = false,
    withTags = false,
    targetId,
    targetType,
  }: {
    targetId: string | number;
    targetType: 'group' | 'teacher';
    skipDays?: number;
    isWeek?: boolean;
    withTags?: boolean;
  }) {
    // // ! for test
    // const now = new Date(2024, 0, 12);
    const now = new Date();
    now.setDate(now.getDate() + skipDays);

    const weekNumber =
      scheduleUtil.getWeekNumber(now) - scheduleUtil.getWeekOffsetByYear(now);
    const dayNumber: WeekNumberType = isWeek
      ? null
      : ((day) => (day > 0 ? day - 1 : 6))(now.getDay());

    const addHashTag = isWeek;

    const lock = await this.redisService.redlock.lock(
      `ystuty:schedule:${targetType}:${String(targetId).toLowerCase()}`,
      5e3,
    );
    try {
      const { items } = await this.getSchedule(targetId, targetType);

      if (!Array.isArray(items)) {
        return null;
      }

      const week = items.find((w) => w.number === weekNumber);
      if (!week) {
        return null;
      }

      return this.formateWeekDays(
        week,
        dayNumber,
        addHashTag,
        withTags,
        targetType,
      );
    } catch (error) {
      console.log('[getFormatedSchedule] Error', error.message);
    } finally {
      await lock.unlock();
    }

    return false;
  }

  private formateWeekDays(
    week: OneWeek,
    dayNumber: WeekNumberType | null = null,
    addHashTag: boolean = false,
    withTags = false,
    targetType: 'group' | 'teacher',
  ) {
    const fullWeek = dayNumber === null;

    const startDay = fullWeek ? WeekNumberType.Monday : dayNumber;
    const weekDay = week.days.find((e) => e.info.type === startDay);
    if (!fullWeek && !weekDay) {
      return null;
    }

    let message: string = null;
    for (let dayIndex = startDay; dayIndex < 7; ++dayIndex) {
      const day = week.days.find((e) => e.info.type === dayIndex);
      if (!day) {
        if (!fullWeek) {
          break;
        }
        continue;
      }

      if (!message) {
        message = '';
      }

      const {
        info: { type: dayType, date: dayDateStr, weekNumber },
        lessons,
      } = day;
      const dayDate = dayDateStr && new Date(dayDateStr);

      const isDoneDay = dayDate
        ? Date.now() > dayDate.getTime() &&
          lessons.every(
            (e) => !e.endAt || Date.now() > new Date(e.endAt).getTime(),
          )
        : false;

      let msg = '';
      msg += `${scheduleUtil.short2Long2(dayType)} `;
      msg += withTags
        ? `<b>Расписание на <code>${scheduleUtil.short2Long2(
            dayType,
            2,
          )}</code></b>`
        : `Расписание на ${scheduleUtil.short2Long2(dayType, 2)}`;
      if (weekNumber) msg += ` [${weekNumber}]`;
      if (dayDate)
        msg += withTags
          ? isDoneDay
            ? ` <b>(<s>${dayDate.toLocaleDateString('ru-RU')}</s>)</b>`
            : ` <b>(${dayDate.toLocaleDateString('ru-RU')})</b>`
          : ` (${dayDate.toLocaleDateString('ru-RU')})`;
      if (isDoneDay) msg += ` ✅`;
      msg += ` ${weekNumber % 2 === 0 ? 'Ч' : 'Н'}`;
      msg += '\n';

      let lastLesson: Lesson = null;
      for (const index in lessons) {
        const lesson = lessons[index];
        const nextLesson = lessons[index + 1];

        const isDone =
          lesson.endAt && Date.now() > new Date(lesson.endAt).getTime();

        const typeName = getLessonTypeStrArr(lesson.type).join(', ');

        if (
          lastLesson?.number > 0 &&
          lastLesson?.number < 3 &&
          /*lastNumber !== 2 &&*/ lesson.number === 3
        ) {
          msg += `✌ ${scheduleUtil.getTimez('11:40', 40)}. FREE TIME\n`;
        }

        let auditoryName = [lesson.auditoryName, lesson.additionalAuditoryName]
          .filter(Boolean)
          .join('; ');
        const auditory = !auditoryName
          ? ''
          : withTags
            ? ` {<code>${auditoryName}</code>}`
            : ` {${auditoryName}}`;
        const typeStr = !typeName
          ? ''
          : withTags
            ? ` <b>[${typeName}]</b>`
            : ` [${typeName}]`;
        const distantStr = !lesson.isDistant
          ? ''
          : withTags
            ? ' <b>(ONLINE)</b>'
            : ' (ONLINE)';

        let targetStr = (
          targetType === 'group'
            ? [lesson.teacherName, lesson.additionalTeacherId]
            : lesson.groups || ['-']
        )
          .filter(Boolean)
          .join('; ');

        let targetsStrFmt = !targetStr
          ? ''
          : withTags
            ? ` (<i>${targetStr}</i>)`
            : ` (${targetStr})`;

        if (
          lastLesson?.number == lesson.number &&
          !(lesson.type & LessonFlags.Exam)
        ) {
          msg += `Другая П/Г: ${auditory}${distantStr} ${lesson.lessonName}${typeStr}${targetsStrFmt}`;
        } else {
          msg += `${scheduleUtil.getNumberEmoji(lesson.number)} ${((s) =>
            isDone && withTags ? `<s>${s}</s>` : s)(
            lesson.timeRange || lesson.time || '**-**',
          )}.${auditory}${distantStr} ${
            lesson.lessonName
          }${typeStr}${targetsStrFmt}`;
        }

        if (lesson.isDivision) {
          msg += ' П/Г';
        }
        if (isDone) msg += ` ✅`;
        msg += '\n';

        if (lesson.duration > 2 && nextLesson?.number != lesson.number) {
          const [xHours, xMinutes] = (lesson.timeRange || lesson.time)
            .split('-')[0]
            .split(':');
          msg += `${scheduleUtil.getNumberEmoji(lesson.number + 1)} ${((s) =>
            isDone && withTags ? `<s>${s}</s>` : s)(
            scheduleUtil.getTimez(
              `${xHours}:${
                parseInt(xMinutes, 10) + (lesson.number === 5 ? 110 : 100)
              }`,
            ),
          )}. ↑...`;
          if (isDone) msg += ` ✅`;
          msg += `\n`;
        }
        lastLesson = lesson;
      }

      if (!lessons.length) {
        msg += withTags
          ? `<b>✌ FREE TIME. <i>Занятий нет</i></b>\n`
          : `✌ FREE TIME. Занятий нет\n`;
      }

      if (addHashTag) {
        msg += `#${weekNumber % 2 === 0 ? 'Ч' : 'Н'}${scheduleUtil.short2Long2(
          dayType,
          1,
        )}\n`;
      }

      message += fullWeek ? `${msg}\n` : msg;
      if (!fullWeek) {
        break;
      }
    }

    return message;
  }

  public async getSchedule(
    targetId: string | number,
    targetType: 'group' | 'teacher',
  ) {
    const cacheKey = `schedule:${targetType}:${String(targetId).toLowerCase()}`;
    if (this.allowCaching) {
      try {
        const cachedData = await this.redisService.redis.get(cacheKey);
        if (cachedData) {
          const items = JSON.parse(cachedData) as OneWeek[];
          return { isCache: true, items };
        }
      } catch (err) {
        this.logger.error(err);
      }
    }

    const {
      data: { items, isCache },
    } = await firstValueFrom(
      this.httpService.get<{
        isCache: boolean;
        items: OneWeek[];
      }>(`/v1/schedule/${targetType}/${encodeURIComponent(targetId)}`),
    );

    if (items.length === 0) {
      return null;
    }

    const firstAugustDate = new Date(new Date().getFullYear(), 7, 1);
    if (new Date() > firstAugustDate) {
      for (const item of items) {
        item.days = item.days.filter(
          (e) => new Date(e.info.date) >= firstAugustDate,
        );
      }
    }
    // TODO: need check
    const firstFebruaryDate = new Date(new Date().getFullYear(), 1, 1);
    if (new Date() > firstFebruaryDate) {
      for (const item of items) {
        item.days = item.days.filter(
          (e) => new Date(e.info.date) >= firstFebruaryDate,
        );
      }
    }

    if (this.allowCaching) {
      await this.redisService.redis.set(
        cacheKey,
        JSON.stringify(items),
        'EX',
        60 * 5,
      );
    }

    return { isCache, items };
  }
}
