import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaUpdate1788441771291 implements MigrationInterface {
  name = 'SchemaUpdate1788441771291';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD "failureKind" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD "attempts" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD "retryAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "rateLimitCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "rateLimitUntil" TIMESTAMP`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c1aa31bf4af2967be1c972ab3"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."broadcast_delivery_status_enum" RENAME TO "broadcast_delivery_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_delivery_status_enum" AS ENUM('queued', 'retrying', 'sent', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ALTER COLUMN "status" TYPE "public"."broadcast_delivery_status_enum" USING "status"::"text"::"public"."broadcast_delivery_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_delivery_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c1aa31bf4af2967be1c972ab3" ON "broadcast_delivery" ("campaignId", "status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c1aa31bf4af2967be1c972ab3"`,
    );
    // Старая enum-схема не поддерживает retrying, поэтому при откате
    // незавершённые попытки становятся terminal failed.
    await queryRunner.query(
      `UPDATE "broadcast_delivery" SET "status" = 'failed' WHERE "status" = 'retrying'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_delivery_status_enum_old" AS ENUM('queued', 'sent', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ALTER COLUMN "status" TYPE "public"."broadcast_delivery_status_enum_old" USING "status"::"text"::"public"."broadcast_delivery_status_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_delivery_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."broadcast_delivery_status_enum_old" RENAME TO "broadcast_delivery_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c1aa31bf4af2967be1c972ab3" ON "broadcast_delivery" ("campaignId", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "rateLimitUntil"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "rateLimitCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP COLUMN "retryAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP COLUMN "attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP COLUMN "failureKind"`,
    );
  }
}
