export const patternGroupName = '(?<groupName>[А-я]{2,5}-[0-9А-я()]{2,8})';

export const matchGroupName = (str: string) =>
    str.match(new RegExp(patternGroupName, 'i')) as RegExpMatchArray & {
        groups?: { groupName: string };
    };
