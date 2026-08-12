import { MigrationInterface, QueryRunner } from 'typeorm';

export class MainToYtySchema1786540000000 implements MigrationInterface {
  name = 'MainToYtySchema1786540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_campaign_social_enum" AS ENUM('vkontakte', 'telegram')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_campaign_status_enum" AS ENUM('draft', 'queued', 'running', 'completed', 'failed', 'terminated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_campaign_mode_enum" AS ENUM('copy', 'forward', 'text')`,
    );
    await queryRunner.query(
      `CREATE TABLE "broadcast_campaign" ("id" SERIAL NOT NULL, "social" "public"."broadcast_campaign_social_enum" NOT NULL, "status" "public"."broadcast_campaign_status_enum" NOT NULL, "mode" "public"."broadcast_campaign_mode_enum" NOT NULL, "sourceMessage" jsonb NOT NULL, "audienceFilter" jsonb NOT NULL, "createdBySocialId" bigint, "totalCount" integer NOT NULL DEFAULT '0', "sentCount" integer NOT NULL DEFAULT '0', "failedCount" integer NOT NULL DEFAULT '0', "skippedCount" integer NOT NULL DEFAULT '0', "lastError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_22f128001853041845dfc2b4076" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9049894d0bc0f6874bf7302522" ON "broadcast_campaign" ("social", "status")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."broadcast_delivery_status_enum" AS ENUM('queued', 'sent', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `CREATE TABLE "broadcast_delivery" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "userSocialId" integer, "targetSocialId" bigint NOT NULL, "status" "public"."broadcast_delivery_status_enum" NOT NULL, "sentMessageId" character varying, "error" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b288908700783fec760946127ec" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f35305261972116174ca53ecde" ON "broadcast_delivery" ("campaignId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD CONSTRAINT "FK_f0068e3b986a90324ef0f11d943" FOREIGN KEY ("campaignId") REFERENCES "broadcast_campaign"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" ADD CONSTRAINT "FK_8fd2ffea4ae2068ae8f87c6ed80" FOREIGN KEY ("userSocialId") REFERENCES "user_social"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."schedule_notification_transport_enum" AS ENUM('vkontakte', 'telegram')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_notification_targettype_enum" AS ENUM('group', 'teacher')`,
    );
    await queryRunner.query(
      `CREATE TABLE "schedule_notification" ("id" SERIAL NOT NULL, "userSocialId" integer, "conversationId" integer, "transport" "public"."schedule_notification_transport_enum" NOT NULL, "targetType" "public"."schedule_notification_targettype_enum" NOT NULL, "targetId" character varying(128) NOT NULL, "deliveryHour" smallint NOT NULL, "deliveryMinute" smallint NOT NULL DEFAULT '0', "targetDayOffset" smallint NOT NULL, "weekdays" smallint array NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, "missingTargetAttempts" smallint NOT NULL DEFAULT '0', "lastDeliveredAt" TIMESTAMP WITH TIME ZONE, "lastFailedAt" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5f596f378087cbba2d79645dcc7" UNIQUE ("conversationId"), CONSTRAINT "PK_85cd36da7215a026ef5a7962c89" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45ee436acbb34e96c4a614ad6b" ON "schedule_notification" ("userSocialId", "isEnabled")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ADD CONSTRAINT "FK_315fa7d608668062386609885ab" FOREIGN KEY ("userSocialId") REFERENCES "user_social"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ADD CONSTRAINT "FK_5f596f378087cbba2d79645dcc7" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."schedule_notification_delivery_status_enum" AS ENUM('pending', 'sent', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `CREATE TABLE "schedule_notification_delivery" ("id" SERIAL NOT NULL, "notifId" integer NOT NULL, "scheduledFor" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."schedule_notification_delivery_status_enum" NOT NULL, "sentMessageId" character varying, "error" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_443e54b4c5fba84ec359c741326" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c2ab3e4d305cc82e8b6cf7a259" ON "schedule_notification_delivery" ("notifId", "scheduledFor")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification_delivery" ADD CONSTRAINT "FK_db3b315fbc4f7e05440a21d2e42" FOREIGN KEY ("notifId") REFERENCES "schedule_notification"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schedule_notification_delivery" DROP CONSTRAINT "FK_db3b315fbc4f7e05440a21d2e42"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2ab3e4d305cc82e8b6cf7a259"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_notification_delivery"`);
    await queryRunner.query(
      `DROP TYPE "public"."schedule_notification_delivery_status_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "schedule_notification" DROP CONSTRAINT "FK_5f596f378087cbba2d79645dcc7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" DROP CONSTRAINT "FK_315fa7d608668062386609885ab"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45ee436acbb34e96c4a614ad6b"`,
    );
    await queryRunner.query(`DROP TABLE "schedule_notification"`);
    await queryRunner.query(
      `DROP TYPE "public"."schedule_notification_targettype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."schedule_notification_transport_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP CONSTRAINT "FK_8fd2ffea4ae2068ae8f87c6ed80"`,
    );
    await queryRunner.query(
      `ALTER TABLE "broadcast_delivery" DROP CONSTRAINT "FK_f0068e3b986a90324ef0f11d943"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f35305261972116174ca53ecde"`,
    );
    await queryRunner.query(`DROP TABLE "broadcast_delivery"`);
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_delivery_status_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_9049894d0bc0f6874bf7302522"`,
    );
    await queryRunner.query(`DROP TABLE "broadcast_campaign"`);
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_campaign_mode_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_campaign_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."broadcast_campaign_social_enum"`,
    );
  }
}
