/**
 * Remove indents
 */
export const xs = (
    strings: TemplateStringsArray,
    ...expressions: any[]
): string => {
    const indent: RegExp = !strings[0].startsWith('\n')
        ? null
        : new RegExp(`\n {${strings[0].match(/\n+( *)/)[1].length}}`, 'g');
    return expressions
        .reduce(
            (acc, expr, i) =>
                `${acc}${expr}${strings[i + 1].replace(indent, '\n')}`,
            strings[0].replace(indent, '\n'),
        )
        .replace(/^\n|\n$/g, '');
};

export const escapeHTMLCodeChars = (text: string) =>
    text.replace(/</gi, '&lt;').replace(/>/gi, '&gt;').replace(/&/gi, '&amp;');

export const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
