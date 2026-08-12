import { InitialSchema1786530000000 } from './1786530000000-InitialSchema';
import { MainToYtySchema1786540000000 } from './1786540000000-MainToYtySchema';

describe('database migrations', () => {
  const createQueryRunner = () => {
    const queries: string[] = [];
    return {
      queries,
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
      }),
    };
  };

  it('creates the baseline schema before feature tables that depend on it', async () => {
    const queryRunner = createQueryRunner();

    await new InitialSchema1786530000000().up(queryRunner as never);
    await new MainToYtySchema1786540000000().up(queryRunner as never);

    const userSocialCreateIndex = queryRunner.queries.findIndex(
      (query) =>
        query.includes('CREATE UNIQUE INDEX') && query.includes('user_social'),
    );
    const broadcastFk = queryRunner.queries.findIndex(
      (query) =>
        query.includes('ALTER TABLE "broadcast_delivery"') &&
        query.includes('REFERENCES "user_social"'),
    );
    const conversationTable = queryRunner.queries.findIndex((query) =>
      query.includes('CREATE TABLE IF NOT EXISTS "conversation"'),
    );
    const scheduleConversationFk = queryRunner.queries.findIndex(
      (query) =>
        query.includes('ALTER TABLE "schedule_notification"') &&
        query.includes('REFERENCES "conversation"'),
    );

    expect(userSocialCreateIndex).toBeGreaterThan(-1);
    expect(broadcastFk).toBeGreaterThan(userSocialCreateIndex);
    expect(conversationTable).toBeGreaterThan(-1);
    expect(scheduleConversationFk).toBeGreaterThan(conversationTable);
  });
});
