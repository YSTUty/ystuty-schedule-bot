import { getTransportErrorHandlerLabel } from './transport-exception-context.util';

describe('getTransportErrorHandlerLabel', () => {
  it('formats the Nest class and handler names', () => {
    class ScheduleUpdate {
      async hearScheduleWeek() {}
    }

    expect(
      getTransportErrorHandlerLabel({
        getClass: () => ScheduleUpdate,
        getHandler: () => ScheduleUpdate.prototype.hearScheduleWeek,
      }),
    ).toBe('ScheduleUpdate.hearScheduleWeek');
  });

  it('uses stable unknown labels for an anonymous execution context', () => {
    expect(
      getTransportErrorHandlerLabel({
        getClass: () => undefined as never,
        getHandler: () => undefined as never,
      }),
    ).toBe('unknown.unknown');
  });
});
