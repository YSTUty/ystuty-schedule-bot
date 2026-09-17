import { LessonFlags } from '@my-interfaces';

export const getLessonTypeStrArr = (type: LessonFlags) => {
  const types: string[] = [];
  if (type & LessonFlags.Lecture) types.push('Лек');
  if (type & LessonFlags.Practical) types.push('ПР');
  if (type & LessonFlags.Labaratory) types.push('ЛР');
  if (type & LessonFlags.CourseProject) types.push('КП');
  if (type & LessonFlags.Consultation) types.push('Консультация');
  if (type & LessonFlags.DifferentiatedTest) types.push('ДИФ.ЗАЧ');
  if (type & LessonFlags.Test) types.push('ЗАЧ');
  if (type & LessonFlags.Exam) types.push('ЭКЗ');
  if (type & LessonFlags.Library) types.push('Библиотека');
  if (type & LessonFlags.ResearchWork) types.push('НИР');
  if (type & LessonFlags.OrganizationalMeeting) types.push('Орг. собрание');
  if (type & LessonFlags.Practice) types.push('Практика');
  if (type & LessonFlags.Event) types.push('Событие');
  if (type & LessonFlags.MilitaryTraining) types.push('ВУЦ');
  if (type & LessonFlags.PhysicalTraining) types.push('Физ. культура');
  if (type & LessonFlags.Elective) types.push('Факультатив');
  if (type & LessonFlags.External) types.push('Внешнее занятие');
  if (type & LessonFlags.Tenzor) types.push('Тензор');
  if (type & LessonFlags.School21) types.push('Школа 21');
  if (type & LessonFlags.Unsupported) types.push('N/A');
  if (type === LessonFlags.None) types.push('???');
  return types;
};
