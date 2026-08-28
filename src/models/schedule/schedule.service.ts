import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';

import { firstValueFrom } from 'rxjs/internal/firstValueFrom';

import { isConcurrencyControlError, matchGroupName, md5 } from '@my-common';
import { OneWeek, WeekNumberType } from '@my-interfaces';

import { ConcurrencyService } from '../concurrency/concurrency.service';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';

import * as scheduleUtil from './util/schedule.util';
import {
  formatScheduleWeekDays,
  SchedulePresentation,
} from './util/schedule-formatter.util';

type Teacher = {
  id: number;
  name: string;
};

export type GroupInstitute = {
  name: string;
  groups: string[];
};

@Injectable()
export class ScheduleService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleService.name);
  protected allowCaching = true;

  constructor(
    private readonly httpService: HttpService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
  ) {}

  private allGroupsList: GroupInstitute[] = [];
  private allTeachersList: Teacher[] = [];
  private groupsChecksum?: string;
  private teachersChecksum?: string;

  async onModuleInit() {
    this.logger.debug('Start load all groups & teachers');
    await Promise.all([this.loadAllGroups(), this.loadAllTeachers()]);
  }

  @Cron(CronExpression.EVERY_10_MINUTES, { waitForCompletion: true })
  protected async onLoadData() {
    await Promise.all([this.loadAllGroups(), this.loadAllTeachers()]);
  }

  protected async loadAllGroups() {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{
          name: string;
          items: GroupInstitute[];
        }>('/v1/schedule/actual_groups'),
      );

      if (!Array.isArray(data.items)) {
        this.logger.warn('YSTU institutes&groups NOT loaded');
        return null;
      }

      const groups = data.items.filter(Boolean);
      const checksum = this.getGroupsChecksum(groups);
      const isInitialLoad = this.groupsChecksum === undefined;
      const isChanged = this.groupsChecksum !== checksum;
      this.allGroupsList = groups;
      this.groupsChecksum = checksum;

      if (isInitialLoad || isChanged) {
        this.logger.log(
          `YSTU institutes&groups ${isInitialLoad ? 'loaded' : 'updated'}: (${groups.length}&${groups.reduce((cnt, inst) => cnt + inst.groups.length, 0)})`,
        );
      }
      return true;
    } catch (error) {
      this.logger.error(
        'Failed to load YSTU institutes&groups',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return false;
  }

  protected async loadAllTeachers() {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<{
          isCache: boolean;
          items: Teacher[];
        }>('/v1/schedule/actual_teachers'),
      );

      if (!Array.isArray(data.items)) {
        this.logger.warn('YSTU teachers NOT loaded');
        return null;
      }

      const teachers = data.items.filter(Boolean);
      const checksum = this.getTeachersChecksum(teachers);
      const isInitialLoad = this.teachersChecksum === undefined;
      const isChanged = this.teachersChecksum !== checksum;
      this.allTeachersList = teachers;
      this.teachersChecksum = checksum;

      if (isInitialLoad || isChanged) {
        this.logger.log(
          `YSTU teachers ${isInitialLoad ? 'loaded' : 'updated'}: (${teachers.length})`,
        );
      }
      return true;
    } catch (error) {
      this.logger.error(
        'Failed to load YSTU teachers',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return false;
  }

  /** Формирует order-independent checksum, чтобы не логировать перестановку API-элементов. */
  private getGroupsChecksum(groups: GroupInstitute[]) {
    return md5(
      JSON.stringify(
        groups
          .map((institute) => ({
            name: institute.name,
            groups: [...institute.groups].sort(),
          }))
          .sort((first, second) => first.name.localeCompare(second.name, 'ru')),
      ),
    );
  }

  /** Формирует order-independent checksum по стабильным ID и ФИО преподавателей. */
  private getTeachersChecksum(teachers: Teacher[]) {
    return md5(
      JSON.stringify(
        [...teachers].sort((first, second) => first.id - second.id),
      ),
    );
  }

  public getGroupByName(groupName?: string | null) {
    const parse = (str: string) =>
      str
        .trim()
        .toLowerCase()
        .replace(/[\)\(\s\-]/g, '');

    return (
      groupName && this.groupNames.find((e) => parse(e) === parse(groupName))
    );
  }

  /** Находит группу по короткому callback-идентификатору Telegram. */
  public groupNameByHash(groupHash: string) {
    return this.groupNames.find((groupName) =>
      md5(groupName).startsWith(groupHash),
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

  /** Нормализует список групп из скопированного текста, сохраняя порядок ввода. */
  public parseGroupNames(text: string): string[] {
    const candidates = text
      .split(/[,;\n]+/)
      .flatMap((part) => [part, ...(matchGroupName(part, 'gi') || [])]);
    const groupNames = new Set<string>();

    for (const candidate of candidates) {
      const groupName = this.getGroupByName(candidate);
      if (groupName) groupNames.add(groupName);
    }

    return [...groupNames];
  }

  public get randomGroupName() {
    const names = this.groupNames;
    return names[Math.floor(Math.random() * names.length)] || '-';
  }

  public get groupNames() {
    return this.allGroupsList.flatMap((e) => e.groups);
  }

  /** Возвращает институты с подмножеством групп, сохраняя порядок Schedule API. */
  public getGroupInstitutes(groupNames?: readonly string[]): GroupInstitute[] {
    const allowedGroupNames = groupNames && new Set(groupNames);

    return this.allGroupsList
      .map((institute) => ({
        name: institute.name,
        groups: allowedGroupNames
          ? institute.groups.filter((groupName) =>
              allowedGroupNames.has(groupName),
            )
          : [...institute.groups],
      }))
      .filter((institute) => institute.groups.length > 0);
  }

  public instituteNameByHash(instituteHash: string) {
    const name = this.allGroupsList.find((e) =>
      md5(e.name).startsWith(instituteHash),
    )?.name;
    return name;
  }

  public groupsList(page = 1, count = 20, instituteHash: string | null = null) {
    const groupNames = this.allGroupsList
      .filter((e) => !instituteHash || md5(e.name).startsWith(instituteHash))
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

  public getTeacher(id: number) {
    return this.allTeachersList.find((teacher) => teacher.id === id);
  }

  public getTeacherName(id: number) {
    return this.getTeacher(id)?.name;
  }

  public getTeacherByExactName(name?: string | null) {
    if (!name) return undefined;

    const normalizedName = this.normalizeTeacherName(name);
    const teachers = this.allTeachersList.filter(
      (teacher) => this.normalizeTeacherName(teacher.name) === normalizedName,
    );

    return teachers.length === 1 ? teachers[0] : undefined;
  }

  /** Проверяет, что текст содержит значимую часть ФИО одного преподавателя. */
  public isTeacherSearchFallbackQuery(query?: string | null) {
    const normalizedQuery = this.normalizeTeacherName(query || '');
    if (normalizedQuery.length < 5) return false;

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    return this.allTeachersList.some((teacher) => {
      const teacherTokens = this.normalizeTeacherName(teacher.name)
        .split(' ')
        .filter(Boolean);

      return queryTokens.every((queryToken) =>
        teacherTokens.some((teacherToken) => teacherToken.includes(queryToken)),
      );
    });
  }

  public teachersList(page = 1, count = 20, query?: string | null) {
    const normalizedQuery = this.normalizeTeacherName(query || '');
    const searchTokens = normalizedQuery.split(' ').filter(Boolean);
    const teachers = this.allTeachersList
      .filter((teacher) => {
        const normalizedName = this.normalizeTeacherName(teacher.name);
        return searchTokens.every((token) => normalizedName.includes(token));
      })
      .sort((first, second) => {
        const normalizedCompare = this.normalizeTeacherName(
          first.name,
        ).localeCompare(this.normalizeTeacherName(second.name), 'ru');
        if (normalizedCompare !== 0) return normalizedCompare;

        const originalCompare = first.name.localeCompare(second.name, 'ru');
        return originalCompare || first.id - second.id;
      });
    const totalCount = teachers.length;
    const safeCount = Math.max(1, count);
    const totalPages = Math.max(1, Math.ceil(totalCount / safeCount));
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const offset = (currentPage - 1) * safeCount;
    const items = teachers.slice(offset, offset + safeCount);

    return {
      items,
      currentPage,
      totalPages,
      totalCount,
      query: query?.trim() || '',
    };
  }

  private normalizeTeacherName(name: string) {
    return name
      .trim()
      .toLocaleLowerCase('ru')
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public async findNext({
    skipDays = 0,
    isWeek = false,
    weekNumber = WeekNumberType.Monday,
    withTags = false,
    presentation = 'compact',
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
    presentation?: SchedulePresentation;
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
      skipDays: number,
      weekNumber: WeekNumberType,
      isWeek?: boolean,
      next?: boolean,
    ): Promise<[number, string | false | null]> => {
      const responseSchedule = await this.getFormatedSchedule({
        targetType,
        targetId,
        skipDays,
        isWeek,
        withTags,
        presentation,
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
    presentation = 'compact',
    targetId,
    targetType,
  }: {
    targetId: string | number;
    targetType: 'group' | 'teacher';
    skipDays?: number;
    isWeek?: boolean;
    withTags?: boolean;
    presentation?: SchedulePresentation;
  }) {
    // // ! for test
    // const now = new Date(2024, 0, 12);
    const now = new Date();
    now.setDate(now.getDate() + skipDays);

    const weekNumber =
      scheduleUtil.getWeekNumber(now) - scheduleUtil.getWeekOffsetByYear(now);
    const dayNumber: WeekNumberType | null = isWeek
      ? null
      : ((day) => (day > 0 ? day - 1 : 6))(now.getDay());

    const addHashTag = isWeek;

    const loadSchedule = async () => {
      const response = await this.getSchedule(targetId, targetType);
      if (!response) {
        return null;
      }
      const { items } = response;

      if (!Array.isArray(items)) {
        return null;
      }

      const week = items.find((w) => w.number === weekNumber);
      if (!week) {
        return null;
      }

      return formatScheduleWeekDays({
        week,
        dayNumber,
        addHashTag,
        withTags,
        targetType,
        presentation,
      });
    };

    try {
      return await this.concurrencyService.exclusiveDistributed(
        this.concurrencyService.buildKey(
          'ystuty:schedule',
          targetType,
          String(targetId).toLowerCase(),
        ),
        loadSchedule,
        { ttlMs: 5e3 },
      );
    } catch (error) {
      if (isConcurrencyControlError(error)) {
        throw error;
      }
      this.logger.error(
        'Failed to load formatted schedule',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
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
