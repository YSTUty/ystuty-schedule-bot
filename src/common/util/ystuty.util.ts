export const patternTeacherId = '(?<teacherId>[0-9]{2,6})';
const patternGroupNameTemplate =
  '?<groupName>[А-я]{2,6}(-|\\s)([0-9]{1,2}\\(?[А-я]{1,2}\\)?)(\\s?\\(?[0-9А-я\\-]{1,7}\\)?)?';
export const patternGroupName = `(${patternGroupNameTemplate})`;
export const patternGroupName0 = `(${patternGroupNameTemplate}|0)`;

export const matchGroupName = (str: string, flags = 'i') =>
  str.match(new RegExp(patternGroupName, flags)) as
    | null
    | (RegExpMatchArray & { groups?: { groupName: string } });
