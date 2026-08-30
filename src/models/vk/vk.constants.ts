export const AUTH_SCENE = 'AUTH_SCENE';
export const SELECT_GROUP_SCENE = 'SELECT_GROUP_SCENE';

/** Доступные боту реакции VK: emoji используется в прикладном коде, ID — в API. */
export const VK_REACTIONS = {
  1: '❤️',
  2: '🔥',
  3: '😂',
  4: '👍',
  5: '💩',
  6: '💔',
  7: '😭',
  8: '😡',
  9: '👎',
  10: '👌',
  11: '😁',
  12: '🤔',
  13: '🙏',
  14: '😘',
  15: '😍',
  16: '🎉',
  19: '🏆',
} as const;

export type VkReactionEmoji = (typeof VK_REACTIONS)[keyof typeof VK_REACTIONS];

/** Обратная таблица для передачи в коде emoji вместо числового ID VK API. */
export const VK_REACTION_IDS = Object.fromEntries(
  Object.entries(VK_REACTIONS).map(([id, emoji]) => [emoji, Number(id)]),
) as Record<VkReactionEmoji, number>;
