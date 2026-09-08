import { getMetadataArgsStorage, type ValueTransformer } from 'typeorm';

import { Conversation } from '../social/entity/conversation.entity';
import { UserSocial } from '../user/entity/user-social.entity';

const getBigintTransformer = (
  target: typeof Conversation | typeof UserSocial,
  propertyName: string,
) => {
  const column = getMetadataArgsStorage().columns.find(
    (metadata) =>
      metadata.target === target && metadata.propertyName === propertyName,
  );
  const transformer = column?.options.transformer;
  return (Array.isArray(transformer) ? transformer[0] : transformer) as
    | ValueTransformer
    | undefined;
};

describe('Schedule notification recipient bigint transformers', () => {
  it.each([
    [Conversation, 'conversationId'],
    [UserSocial, 'socialId'],
  ] as const)(
    'allows a missing optional relation for %s.%s',
    (target, field) => {
      const transformer = getBigintTransformer(target, field);

      expect(transformer?.from(null)).toBeNull();
      expect(transformer?.from('42')).toBe(42n);
    },
  );
});
