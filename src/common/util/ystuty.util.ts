export const patternGroupName = '(?<groupName>[А-я]{2,5}-[0-9А-я()]{2,8})';
export const patternGroupName0 = '(?<groupName>[А-я]{2,5}-[0-9А-я()]{2,8}|0)';

export const matchGroupName = (str: string, flags = 'i') =>
  str.match(new RegExp(patternGroupName, flags)) as
    | null
    | (RegExpMatchArray & {
        groups?: { groupName: string };
      });
