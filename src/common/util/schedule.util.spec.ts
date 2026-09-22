import { selectGroupCommandRegExp } from './schedule.util';

describe('selectGroupCommandRegExp', () => {
  it('accepts an explicit command with a nonstandard long group name', () => {
    const match = selectGroupCommandRegExp.exec('группа Научно-исслед сем');

    expect(match?.groups).toMatchObject({
      trigger: 'группа',
      groupName: 'Научно-исслед сем',
    });
  });

  it('does not treat a bare group name as an explicit command', () => {
    expect(selectGroupCommandRegExp.test('Научно-исслед сем')).toBe(false);
  });

  it.each(['выбрать группу', 'выбрать учебную группу', 'учебная группа'])(
    'accepts the extended selection command with a group name: %s',
    (trigger) => {
      const match = selectGroupCommandRegExp.exec(
        `${trigger} Научно-исслед сем`,
      );

      expect(match?.groups).toMatchObject({
        trigger,
        groupName: 'Научно-исслед сем',
      });
    },
  );
});
