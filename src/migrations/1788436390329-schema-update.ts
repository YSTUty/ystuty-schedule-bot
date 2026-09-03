import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaUpdate1788436390329 implements MigrationInterface {
  name = 'SchemaUpdate1788436390329';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_admin_delivery_social_enum" AS ENUM('vkontakte', 'telegram')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_admin_delivery_status_enum" AS ENUM('pending', 'retrying', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "feedback_admin_delivery" ("id" SERIAL NOT NULL, "feedbackId" integer NOT NULL, "social" "public"."feedback_admin_delivery_social_enum" NOT NULL, "adminId" character varying(32) NOT NULL, "status" "public"."feedback_admin_delivery_status_enum" NOT NULL DEFAULT 'pending', "headerSentAt" TIMESTAMP, "deliveredAt" TIMESTAMP, "attempts" integer NOT NULL DEFAULT '0', "retryAt" TIMESTAMP, "lastError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f7deb80b89b758c62886d358c09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_71cdd1ece5cc8b8149a97dab5a" ON "feedback_admin_delivery" ("feedbackId", "social", "adminId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99e51e7f4394254b1060f0d192" ON "feedback_admin_delivery" ("social", "status", "retryAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback_admin_delivery" ADD CONSTRAINT "FK_fec2c38479fec0865b7744068c2" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feedback_admin_delivery" DROP CONSTRAINT "FK_fec2c38479fec0865b7744068c2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99e51e7f4394254b1060f0d192"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_71cdd1ece5cc8b8149a97dab5a"`,
    );
    await queryRunner.query(`DROP TABLE "feedback_admin_delivery"`);
    await queryRunner.query(
      `DROP TYPE "public"."feedback_admin_delivery_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."feedback_admin_delivery_social_enum"`,
    );
  }
}
