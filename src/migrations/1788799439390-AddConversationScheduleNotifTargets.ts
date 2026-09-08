import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationScheduleNotifTargets1788799439390 implements MigrationInterface {
  name = 'AddConversationScheduleNotifTargets1788799439390';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FK с conversation не меняется: TypeORM добавил её пересоздание в diff,
    // хотя для удаления unique-ограничения оно не требуется.
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" DROP CONSTRAINT "UQ_5f596f378087cbba2d79645dcc7"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07b5cc1efb8beb8004b583e572" ON "schedule_notification" ("conversationId", "isEnabled")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_07b5cc1efb8beb8004b583e572"`,
    );
    // PostgreSQL не позволит откатить миграцию, пока в беседе есть несколько
    // рассылок. Это сохраняет данные вместо их неявного удаления.
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ADD CONSTRAINT "UQ_5f596f378087cbba2d79645dcc7" UNIQUE ("conversationId")`,
    );
  }
}
