import { MigrationInterface, QueryRunner } from 'typeorm';

export class BroadcastCampaignActionKeyboard1787819258585 implements MigrationInterface {
  name = 'BroadcastCampaignActionKeyboard1787819258585';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "actionKeyboard" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "actionKeyboard"`,
    );
  }
}
