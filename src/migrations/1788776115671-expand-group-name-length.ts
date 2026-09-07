import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandGroupNameLength1788776115671 implements MigrationInterface {
  name = 'ExpandGroupNameLength1788776115671';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "groupName" TYPE character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_social" ALTER COLUMN "groupName" TYPE character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "groupName" TYPE character varying(128)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "groupName" TYPE character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_social" ALTER COLUMN "groupName" TYPE character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ALTER COLUMN "groupName" TYPE character varying(16)`,
    );
  }
}
