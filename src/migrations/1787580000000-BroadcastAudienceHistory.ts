import { MigrationInterface, QueryRunner } from 'typeorm';

export class BroadcastAudienceHistory1787580000000 implements MigrationInterface {
  name = 'BroadcastAudienceHistory1787580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_social" ADD "lastInteractionAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "contentPreview" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "messagesDeletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD "messageDeletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD "messageDeleteError" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP COLUMN "messageDeleteError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP COLUMN "messageDeletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "messagesDeletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "contentPreview"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_social" DROP COLUMN "lastInteractionAt"`,
    );
  }
}
