import { LessonFlags } from '@my-interfaces';

export const getLessonTypeStrArr = (type: LessonFlags) => {
    const types: string[] = [];
    if (type & LessonFlags.Lecture) types.push('Лек');
    if (type & LessonFlags.Practical) types.push('ПР');
    if (type & LessonFlags.Labaratory) types.push('ЛР');
    if (type & LessonFlags.CourseProject) types.push('КП');
    if (type & LessonFlags.None) types.push('???');
    return types;
};
