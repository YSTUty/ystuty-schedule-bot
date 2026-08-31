import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaUpdate1788159482783 implements MigrationInterface {
  name = 'SchemaUpdate1788159482783';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_social" ADD "broadcastDisabledAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_social" DROP COLUMN "broadcastDisabledAt"`,
    );
  }
}
