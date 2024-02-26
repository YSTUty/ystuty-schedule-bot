export const patternGroupName =
  '(?<groupName>[А-я]{2,6}(-|\\s)[0-9А-я()]{2,8}(\\s[0-9А-я()]{1,5})?)';
export const patternGroupName0 =
  '(?<groupName>[А-я]{2,6}(-|\\s)[0-9А-я()]{2,8}(\\s[0-9А-я()]{1,5})?|0)';

export const matchGroupName = (str: string, flags = 'i') =>
  str.match(new RegExp(patternGroupName, flags)) as
    | null
    | (RegExpMatchArray & {
        groups?: { groupName: string };
      });
