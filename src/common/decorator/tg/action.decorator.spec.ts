import { ListenerDecorator } from 'nestjs-telega';

import { LocalePhrase } from '@my-interfaces';

import { Action } from './action.decorator';

describe('Telegram Action decorator', () => {
  it('rejects an oversized static callback while registering a listener', () => {
    expect(() => Action('я'.repeat(33))).toThrow('received 66');
  });

  it('rejects a regexp whose shortest callback exceeds the Telegram limit', () => {
    expect(() => Action(new RegExp(`^${'я'.repeat(33)}$`))).toThrow(
      'requires at least 66',
    );
  });

  it('rejects an oversized callback regexp built from a locale phrase key', () => {
    const phrase = LocalePhrase.Button_Schedule_Schedule.replaceAll('.', '\\.');
    const action = new RegExp(`^${phrase}:${'я'.repeat(33)}$`);

    expect(() => Action(action)).toThrow('maximum is 64');
  });

  it('keeps the original regexp trigger in listener metadata', () => {
    const regexp = /^selectGroup:(?<groupName>.+)$/;
    const decorator = Action(regexp);
    const target = {};
    const descriptor = {
      value: () => undefined,
    } as TypedPropertyDescriptor<() => void>;
    decorator(target, 'handler', descriptor);

    const metadata = Reflect.getMetadata(
      ListenerDecorator.KEY,
      descriptor.value!,
    ) as Array<{ args: [RegExp] }>;

    expect(metadata[0].args[0]).toBe(regexp);
  });
});
