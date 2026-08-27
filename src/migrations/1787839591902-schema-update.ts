import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaUpdate1787839591902 implements MigrationInterface {
  name = 'SchemaUpdate1787839591902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "settingsVersion" integer NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "settingsVersion"`,
    );
  }
}
