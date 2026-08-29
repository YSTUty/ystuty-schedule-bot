import { MigrationInterface, QueryRunner } from 'typeorm';

export class Feedback1787940816594 implements MigrationInterface {
  name = 'Feedback1787940816594';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_social_enum" AS ENUM('vkontakte', 'telegram')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_category_enum" AS ENUM('schedule', 'bot', 'suggestion', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_deliverystatus_enum" AS ENUM('pending', 'sent', 'partial', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "feedback" ("id" SERIAL NOT NULL, "userSocialId" integer, "social" "public"."feedback_social_enum" NOT NULL, "category" "public"."feedback_category_enum" NOT NULL, "sourcePeerId" character varying(32) NOT NULL, "content" jsonb NOT NULL, "deliveryStatus" "public"."feedback_deliverystatus_enum" NOT NULL DEFAULT 'pending', "deliveredAt" TIMESTAMP, "deliveryError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8389f9e087a57689cd5be8b2b13" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f474017aacf9b7fe9d949953ed" ON "feedback" ("social", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27c23eb8a6872012f700a959d8" ON "feedback" ("userSocialId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" ADD CONSTRAINT "FK_cc69329ae462a3c815c3f4acfa0" FOREIGN KEY ("userSocialId") REFERENCES "user_social"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feedback" DROP CONSTRAINT "FK_cc69329ae462a3c815c3f4acfa0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_27c23eb8a6872012f700a959d8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f474017aacf9b7fe9d949953ed"`,
    );
    await queryRunner.query(`DROP TABLE "feedback"`);
    await queryRunner.query(
      `DROP TYPE "public"."feedback_deliverystatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."feedback_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."feedback_social_enum"`);
  }
}
