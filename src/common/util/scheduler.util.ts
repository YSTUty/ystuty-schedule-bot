import { LessonFlags } from '@my-interfaces';

export const getLessonTypeStrArr = (type: LessonFlags) => {
  const types: string[] = [];
  if (type & LessonFlags.Lecture) types.push('Лек');
  if (type & LessonFlags.Practical) types.push('ПР');
  if (type & LessonFlags.Labaratory) types.push('ЛР');
  if (type & LessonFlags.CourseProject) types.push('КП');
  if (type & LessonFlags.Consultation) types.push('Консультаця');
  if (type & LessonFlags.Test) types.push('ЗАЧ');
  if (type & LessonFlags.DifferentiatedTest) types.push('ДИФ.ЗАЧ');
  if (type & LessonFlags.Exam) types.push('ЭКЗ');
  if (type & LessonFlags.None) types.push('???');
  return types;
};
