import { of } from 'rxjs';

import { ScheduleApiClient } from './schedule-api.client';

describe('ScheduleApiClient', () => {
  const createClient = () => {
    const httpService = {
      get: jest.fn(() => of({ data: {} })),
    };

    return {
      httpService,
      client: new ScheduleApiClient(httpService as any),
    };
  };

  it.each([
    [
      'count',
      (client: ScheduleApiClient) => client.getCount(),
      '/v1/schedule/count',
    ],
    [
      'actual groups',
      (client: ScheduleApiClient) => client.getActualGroups(),
      '/v1/schedule/actual_groups',
    ],
    [
      'group schedule',
      (client: ScheduleApiClient) => client.getGroupSchedule('ЦИС-17'),
      `/v1/schedule/group/${encodeURIComponent('ЦИС-17')}`,
    ],
    [
      'group week schedule',
      (client: ScheduleApiClient) => client.getGroupWeekSchedule('ЦИС-17'),
      `/v1/schedule/group_week/${encodeURIComponent('ЦИС-17')}`,
    ],
    [
      'actual teachers',
      (client: ScheduleApiClient) => client.getActualTeachers(),
      '/v1/schedule/actual_teachers',
    ],
    [
      'teacher schedule',
      (client: ScheduleApiClient) => client.getTeacherSchedule(42),
      '/v1/schedule/teacher/42',
    ],
    [
      'actual audiences',
      (client: ScheduleApiClient) => client.getActualAudiences(),
      '/v1/schedule/actual_audiences',
    ],
    [
      'audience schedule',
      (client: ScheduleApiClient) => client.getAudienceSchedule('В-201'),
      `/v1/schedule/audience/${encodeURIComponent('В-201')}`,
    ],
    [
      'all audiences',
      (client: ScheduleApiClient) => client.getAllAudiences(),
      '/v1/schedule/all_audiences',
    ],
    [
      'all semesters',
      (client: ScheduleApiClient) => client.getAllSemesters(),
      '/v1/schedule/all_semesters',
    ],
  ])('requests the %s endpoint', async (_name, request, expectedPath) => {
    const { client, httpService } = createClient();

    await request(client);

    expect(httpService.get).toHaveBeenCalledWith(expectedPath, {});
  });

  it('uses semesterId and keeps the local request timeout out of query parameters', async () => {
    const { client, httpService } = createClient();

    await client.getGroupSchedule('ЦИС 17/1', {
      requestTimeoutMs: 4_500,
      semesterId: 123,
    });

    expect(httpService.get).toHaveBeenCalledWith(
      `/v1/schedule/group/${encodeURIComponent('ЦИС 17/1')}`,
      {
        params: { semesterId: 123 },
        timeout: 4_500,
      },
    );
  });

  it('passes the documented additional flag for the expanded group response', async () => {
    const { client, httpService } = createClient();

    await client.getActualGroups({ additional: true, semesterId: 123 });

    expect(httpService.get).toHaveBeenCalledWith('/v1/schedule/actual_groups', {
      params: { additional: true, semesterId: 123 },
    });
  });
});
