/**
 * Данные об институте
 */
export interface IInstituteData {
  /**
   * Название института
   */
  name: string;
  /**
   * Массив групп
   */
  groups: IGroupData[];
}

/**
 * Данные о группе
 */
export interface IGroupData {
  /**
   * Название группы
   */
  name: string;
  /**
   * Ссылка на расписание группы
   */
  link: string;
  /**
   * Ссылка на расписание лекционной недели группы
   */
  linkLecture?: string;
}

/**
 * Тип четности недели для пары
 */
export enum WeekParityType {
  CUSTOM = 0,
  ODD = 1,
  EVEN = 2,
}

/**
 * Флаг типа пары
 */
export enum LessonFlags {
  None = 0,
  Lecture = 1 << 1,
  Practical = 1 << 2,
  Labaratory = 1 << 3,
  CourseProject = 1 << 4,
  Consultation = 1 << 5,
  Test = 1 << 6,
  DifferentiatedTest = 1 << 7,
  Exam = 1 << 8,
  Library = 1 << 9,
  ResearchWork = 1 << 10,
  OrganizationalMeeting = 1 << 11,
  Unsupported = 1 << 12,
}

/**
 * Тип/номер дня недели
 */
export enum WeekNumberType {
  Monday = 0,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
  Sunday = 6,
}

// ****

export interface OneWeek {
  number: number;
  days: OneDay[];
}

/**
 * Filtered Days with lessons from one week
 */
export interface OneDay {
  info: WeekDay;
  lessons: Lesson[];
}

export interface WeekDay {
  type: WeekNumberType;
  date: string;
  weekNumber: number;
}

export interface Lesson {
  /**
   * Порядковый номер пары на дню
   */
  number: number;
  /**
   * Временной интервал пары
   * @example '08:30-10:00'
   */
  time: string;
  /**
   * Timestamp начала пары
   */
  startAt?: string | Date;
  /**
   * Timestamp конца пары
   */
  endAt?: string | Date;
  /**
   * Оригинальная строка с порядковым номером пары на дню со интервалом времени
   *
   * @example '1. 08:30-...4ч'
   */
  originalTimeTitle: string;
  /**
   * Тип четности пары на неделе
   */
  parity: WeekParityType;
  /**
   * Пара дистанционно
   */
  isDistant?: boolean;
  /**
   * Название предмета пары
   */
  lessonName?: string;
  /**
   * Флаг типа пары
   */
  type: LessonFlags;
  /**
   * Занятия в потоке
   */
  isStream: boolean;
  /**
   * Длительность пары в академических часах
   */
  duration: number;
  /**
   * Длительность пары в минутах
   */
  durationMinutes: number;
  /**
   * Разделение по подгруппам
   */
  isDivision: boolean;
  /**
   * Сокращенная пара
   */
  isShort?: boolean;
  /**
   * Пара на лекционной неделе
   */
  isLecture?: boolean;
  /**
   * Буква корпуса и номер аудитори
   */
  auditoryName?: string;
  /**
   * ФИО преподователя
   *
   * @example 'Иванов ИИ'
   */
  teacherName?: string;
  /**
   * Дополнительная информация
   */
  subInfo?: string;
}
