import type {
  FakeVkApiCall,
  FakeVkApiParams,
} from '../../fake-api/vk-api.fake';

export type VkSendMessageCall = FakeVkApiCall<
  'messages.send',
  FakeVkApiParams,
  number
>;
export type VkEditMessageCall = FakeVkApiCall<
  'messages.edit',
  FakeVkApiParams,
  number
>;

export type VkCallbackPayload = Record<string, unknown>;

export const getVkCallbackPayload = <TPayload extends VkCallbackPayload>(
  call: FakeVkApiCall,
  predicate: (payload: VkCallbackPayload) => payload is TPayload,
): TPayload => {
  const keyboard = JSON.parse(String(call.params.keyboard)) as {
    buttons?: { action?: { type?: string; payload?: string } }[][];
  };
  for (const button of keyboard.buttons?.flat() || []) {
    const action = button.action;
    if (action?.type !== 'callback' || typeof action.payload !== 'string') {
      continue;
    }

    const payload = JSON.parse(action.payload) as VkCallbackPayload;
    if (predicate(payload)) return payload;
  }
  throw new Error(`No expected VK callback button in ${call.method}`);
};
