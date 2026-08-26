import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaUpdate1787593901598 implements MigrationInterface {
  name = 'SchemaUpdate1787593901598';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_feedback_social_enum" AS ENUM('vkontakte', 'telegram')`,
    );
    await queryRunner.query(
      `CREATE TABLE "broadcast_feedback" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "deliveryId" integer NOT NULL, "userSocialId" integer, "social" "public"."broadcast_feedback_social_enum" NOT NULL, "action" character varying(16) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3cdc15e242f36a38f2750d919b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_addc41658eeb9a7f487b432734" ON "broadcast_feedback" ("deliveryId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18be96bda5de7c60aaad1e5823" ON "broadcast_feedback" ("campaignId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_broadcast_feedback_initial_delivery" ON "broadcast_feedback" ("deliveryId") WHERE "action" = 'initial'`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" ADD "feedbackButton" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" ADD CONSTRAINT "FK_cdc93e3a9077cff49306a0de582" FOREIGN KEY ("campaignId") REFERENCES "broadcast_campaign"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" ADD CONSTRAINT "FK_b9150ae6f6ffbce8b0dcfa36def" FOREIGN KEY ("deliveryId") REFERENCES "broadcast_delivery"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" ADD CONSTRAINT "FK_7dd151ec094978d5b401346f351" FOREIGN KEY ("userSocialId") REFERENCES "user_social"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" DROP CONSTRAINT "FK_7dd151ec094978d5b401346f351"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" DROP CONSTRAINT "FK_b9150ae6f6ffbce8b0dcfa36def"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_feedback" DROP CONSTRAINT "FK_cdc93e3a9077cff49306a0de582"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_campaign" DROP COLUMN "feedbackButton"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_broadcast_feedback_initial_delivery"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18be96bda5de7c60aaad1e5823"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_addc41658eeb9a7f487b432734"`,
    );
    await queryRunner.query(`DROP TABLE "broadcast_feedback"`);
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_feedback_social_enum"`,
    );
  }
}
