import { APIError, APIErrorCode } from 'vk-io';

import { getVkApiErrorMethod } from './vk-exception.filter';

describe('getVkApiErrorMethod', () => {
  it('extracts the failed VK API method without logging request payload', () => {
    const error = new APIError({
      error_code: APIErrorCode.SERVER,
      error_msg: 'Internal server error',
      request_params: [
        { key: 'method', value: 'messages.send' },
        { key: 'message', value: 'Не выводить в лог' },
      ],
    });

    expect(getVkApiErrorMethod(error)).toBe('messages.send');
  });

  it('returns undefined when VK does not provide the method', () => {
    const error = new APIError({
      error_code: APIErrorCode.SERVER,
      error_msg: 'Internal server error',
      request_params: [],
    });

    expect(getVkApiErrorMethod(error)).toBeUndefined();
  });
});
