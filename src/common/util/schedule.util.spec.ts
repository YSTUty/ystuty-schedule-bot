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
});
