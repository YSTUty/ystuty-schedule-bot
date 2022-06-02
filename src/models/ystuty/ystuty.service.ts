import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as xEnv from '@my-environment';
import { OneWeek, WeekNumberType } from '@my-interfaces';
import { delay, getLessonTypeStrArr, matchGroupName } from '@my-common';

const getWeekNumber = (date: Date = new Date()) => {
    const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );

    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime();

    const weekNo = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);

    return weekNo;
};

const CurrentWeek = getWeekNumber();
const YEAR_WEEKSOFF = CurrentWeek > 34 ? 34 : /* CurrentWeek < 4 ? -17 : */ 5;

@Injectable()
export class YSTUtyService implements OnModuleInit {
    private readonly logger = new Logger(YSTUtyService.name);

    public readonly ystutyApi = axios.create({
        baseURL: xEnv.YSTUTY_PARSER_URL,
        timeout: 60e3,
    });

    constructor() {}

    private allGroupsList: string[] = [];

    onModuleInit() {
        this.onLoadAllGroups();
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    protected onLoadAllGroups() {
        this.loadAllGroups().then();
    }

    protected async loadAllGroups() {
        try {
            const { data } = await this.ystutyApi.get(
                '/api/ystu/schedule/groups',
            );
            if (!Array.isArray(data.items)) {
                this.logger.warn('YSTU groups NOT loaded');
                return null;
            }

            this.allGroupsList = data.items;
            this.logger.log(`YSTU groups loaded: (${data.items.length})`);
            return true;
        } catch (error) {
            console.log(error.message);
            return false;
        }
    }

    public getGroupByName(groupName?: string) {
        const parse = (str: string) => str.toLowerCase().replace(/[\)\(]/g, '');
        return (
            groupName &&
            this.allGroupsList.find((e) => parse(e) === parse(groupName))
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
        return (
            this.allGroupsList[
                Math.floor(Math.random() * this.allGroupsList.length)
            ] || '-'
        );
    }

    public async findNext({
        groupName,
        skipDays = 0,
        isWeek = false,
        weekNumber = WeekNumberType.Monday,
        next = false,
    }: {
        groupName: string;
        skipDays?: number;
        isWeek?: boolean;
        weekNumber?: WeekNumberType;
        next?: boolean;
    }): Promise<[number, string | false]> {
        const responseSchedule = await this.getFormatedSchedule({
            groupName,
            skipDays,
            isWeek,
        });

        if (responseSchedule === null && !isWeek) {
            if (weekNumber < WeekNumberType.Sunday) {
                const [_skipDays, nextSchedule] = await this.findNext({
                    groupName,
                    skipDays: skipDays + 1,
                    weekNumber: weekNumber + 1,
                    next: true,
                });

                if (next || nextSchedule) {
                    return [_skipDays, nextSchedule];
                }
            } else {
                return [skipDays, false];
            }
        }

        return [skipDays, responseSchedule];
    }

    public async getFormatedSchedule({
        groupName,
        skipDays = 0,
        isWeek = false,
    }: {
        groupName: string;
        skipDays?: number;
        isWeek?: boolean;
    }) {
        const now = new Date();
        now.setDate(now.getDate() + skipDays);

        const weekNumber = getWeekNumber(now) - YEAR_WEEKSOFF;
        const dayNumber: WeekNumberType = isWeek
            ? null
            : ((day) => (day > 0 ? day - 1 : 6))(now.getDay());

        const addHashTag = isWeek;

        // TODO: add caching or RPC

        try {
            const {
                data: { items },
            } = await this.ystutyApi.get<{
                isCache: boolean;
                items: OneWeek[];
            }>(`/api/ystu/schedule/group/${encodeURIComponent(groupName)}`);

            if (!Array.isArray(items)) {
                return null;
            }

            const week = items.find((w) => w.number === weekNumber);
            if (!week) {
                return null;
            }

            return this.formateWeekDays(week, dayNumber, addHashTag);
        } catch (error) {
            console.log(error.message);
        }

        return false;
    }

    private formateWeekDays(
        week: OneWeek,
        dayNumber: WeekNumberType | null = null,
        addHashTag: boolean = false,
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
                info: { type: dayType, dateStr, parity, weekNumber },
                lessons,
            } = day;

            let msg = '';
            msg += `${short2Long2(dayType)} Расписание на ${short2Long2(
                dayType,
                2,
            )} [${weekNumber}]`;
            msg += ` (${dateStr})`;
            msg += ` ${parity === 2 ? 'Ч' : 'Н'}\n`;

            let lastNumber = 0;
            for (const index in lessons) {
                const lesson = lessons[index];
                const nextLesson = lessons[index + 1];

                const typeName = getLessonTypeStrArr(lesson.type).join(', ');

                if (
                    lastNumber > 0 &&
                    lastNumber < 3 &&
                    /*lastNumber !== 2 &&*/ lesson.number === 3
                ) {
                    msg += `✌ ${getTimez('11:40', 40)}. FREE TIME\n`;
                }

                const auditory = !lesson.auditoryName
                    ? ''
                    : ` {${lesson.auditoryName}}`;
                const typeStr = !typeName ? '' : ` [${typeName}]`;
                const distantStr = !lesson.isDistant ? '' : ' (ONLINE)';

                if (lastNumber == lesson.number) {
                    msg += `Другая П/Г: ${auditory}${distantStr} ${
                        lesson.lessonName
                    }${typeStr}${
                        !lesson.teacherName
                            ? ''
                            : ` (${lesson.teacherName.replace(/\s/i, '')})`
                    }`;
                } else {
                    msg += `${getNumberEmoji(lesson.number)} ${
                        lesson.time
                    }.${auditory}${distantStr} ${lesson.lessonName}${typeStr}${
                        !lesson.teacherName
                            ? ''
                            : ` (${lesson.teacherName.replace(/\s/i, '')})`
                    }`;
                }

                if (lesson.isDivision) {
                    msg += ' П/Г';
                }
                msg += '\n';

                if (
                    lesson.duration > 2 &&
                    nextLesson?.number != lesson.number
                ) {
                    const [xHours, xMinutes] = lesson.time
                        .split('-')[0]
                        .split(':');
                    msg += `${getNumberEmoji(lesson.number + 1)} ${getTimez(
                        `${xHours}:${
                            parseInt(xMinutes, 10) +
                            (lesson.number === 5 ? 110 : 100)
                        }`,
                    )}. ↑...\n`;
                }
                lastNumber = lesson.number;
            }

            if (!lessons.length) {
                msg += `✌ FREE TIME. Занятий нет\n`;
            }

            if (addHashTag) {
                msg += `#${parity === 2 ? 'Ч' : 'Н'}${short2Long2(
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
}

function getTimez(startTime: string, durationMinutes = 90) {
    const padTime = (time: number) => time.toString().padStart(2, '0');

    const dateTime = new Date(0);

    const [hours, minutes] = startTime.split(':').map(Number);
    dateTime.setHours(hours, minutes);
    dateTime.setMinutes(dateTime.getMinutes() + durationMinutes);

    const endTime = `${padTime(dateTime.getHours())}:${padTime(
        dateTime.getMinutes(),
    )}`;

    // for safe
    dateTime.setHours(hours, minutes);
    startTime = `${padTime(dateTime.getHours())}:${padTime(
        dateTime.getMinutes(),
    )}`;

    return `${startTime}-${endTime}`;
}

function short2Long2(e: number, q: 0 | 1 | 2 = 0) {
    switch (e) {
        case 0:
            return q === 0
                ? '📕'
                : q === 1
                ? 'Понедельник'
                : q === 2
                ? 'Понедельник'
                : null;
        case 1:
            return q === 0
                ? '📗'
                : q === 1
                ? 'Вторник'
                : q === 2
                ? 'Вторник'
                : null;
        case 2:
            return q === 0
                ? '📘'
                : q === 1
                ? 'Среда'
                : q === 2
                ? 'Среду'
                : null;
        case 3:
            return q === 0
                ? '📙'
                : q === 1
                ? 'Четверг'
                : q === 2
                ? 'Четверг'
                : null;
        case 4:
            return q === 0
                ? '📓'
                : q === 1
                ? 'Пятница'
                : q === 2
                ? 'Пятницу'
                : null;
        case 5:
            return q === 0
                ? '📔'
                : q === 1
                ? 'Суббота'
                : q === 2
                ? 'Субботу'
                : null;
    }
}

function getNumberEmoji(i: number) {
    switch (i % 10 || 1) {
        case 0:
            return '0⃣';
        case 1:
            return '1⃣';
        case 2:
            return '2⃣';
        case 3:
            return '3⃣';
        case 4:
            return '4⃣';
        case 5:
            return '5⃣';
        case 6:
            return '6⃣';
        case 7:
            return '7⃣';
        case 8:
            return '8⃣';
        case 9:
            return '9⃣';
    }
}
