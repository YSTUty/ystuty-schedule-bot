import * as rxjs from 'rxjs';

import { SocialConnectService } from './social-connect.service';

describe('SocialConnectService', () => {
  const createService = () => {
    const post = jest.fn();
    const userService = { auth: jest.fn() };
    const service = new SocialConnectService(
      { post } as any,
      userService as any,
    );

    jest.spyOn((service as any).logger, 'debug').mockImplementation();
    jest.spyOn((service as any).logger, 'error').mockImplementation();
    jest.spyOn((service as any).logger, 'warn').mockImplementation();
    jest.spyOn((service as any).logger, 'log').mockImplementation();

    return { post, service, userService };
  };

  const createAxiosError = (
    message = 'Request failed with status code 502',
    code = 'ERR_BAD_RESPONSE',
  ) =>
    Object.assign(new Error(message), {
      code,
      isAxiosError: true,
      response: { status: 502 },
    });

  it('logs only the first two equal check failures and then suppresses them', async () => {
    const { post, service } = createService();
    post.mockReturnValue(rxjs.throwError(() => createAxiosError()));

    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();

    expect((service as any).logger.error).toHaveBeenCalledTimes(2);
    expect((service as any).logger.error).toHaveBeenNthCalledWith(
      1,
      '[checkAuth] Axios error',
      {
        code: 'ERR_BAD_RESPONSE',
        message: 'Request failed with status code 502',
      },
    );
    expect((service as any).logger.warn).toHaveBeenCalledTimes(1);
    expect((service as any).logger.warn).toHaveBeenCalledWith(
      '[checkAuth] Repeated error output is suppressed until the next successful request',
    );
  });

  it('logs recovery after a successful empty response and starts a new failure series', async () => {
    const { post, service } = createService();
    post
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()))
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()))
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()))
      .mockReturnValueOnce(rxjs.of({ data: { result: [] } }))
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()));

    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();

    expect((service as any).logger.log).toHaveBeenCalledWith(
      '[checkAuth] Social connect request recovered after 3 failed requests',
    );

    jest.clearAllMocks();
    await service.checkAuth();

    expect((service as any).logger.error).toHaveBeenCalledTimes(1);
    expect((service as any).logger.warn).not.toHaveBeenCalled();
    expect((service as any).logger.log).not.toHaveBeenCalled();
  });

  it('does not suppress a failure with another signature', async () => {
    const { post, service } = createService();
    post
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()))
      .mockReturnValueOnce(rxjs.throwError(() => createAxiosError()))
      .mockReturnValueOnce(
        rxjs.throwError(() =>
          createAxiosError('Request timed out', 'ECONNABORTED'),
        ),
      );

    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();

    expect((service as any).logger.error).toHaveBeenCalledTimes(3);
    expect((service as any).logger.warn).not.toHaveBeenCalled();
  });

  it('also suppresses repeated social-connect error responses', async () => {
    const { post, service } = createService();
    const responseError = Object.assign(
      new Error('Request failed with status code 409'),
      {
        code: 'ERR_BAD_REQUEST',
        isAxiosError: true,
        response: {
          status: 409,
          data: {
            error: {
              code: 409,
              message: 'Authorization request is already being processed',
              error: 'conflict',
            },
          },
        },
      },
    );
    post.mockReturnValue(rxjs.throwError(() => responseError));

    await service.checkAuth();
    await service.checkAuth();
    await service.checkAuth();

    expect((service as any).logger.debug).toHaveBeenCalledTimes(2);
    expect((service as any).logger.warn).toHaveBeenCalledTimes(1);
  });
});
