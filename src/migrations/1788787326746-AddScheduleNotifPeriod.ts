import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleNotifPeriod1788787326746 implements MigrationInterface {
  name = 'AddScheduleNotifPeriod1788787326746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."schedule_notification_period_enum" AS ENUM('day', 'week')`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ADD "period" "public"."schedule_notification_period_enum" NOT NULL DEFAULT 'day'`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ALTER COLUMN "targetDayOffset" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Недельная рассылка не имеет смещения дня; до возврата NOT NULL задаём Today.
    await queryRunner.query(
      `UPDATE "schedule_notification" SET "targetDayOffset" = 0 WHERE "targetDayOffset" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" ALTER COLUMN "targetDayOffset" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_notification" DROP COLUMN "period"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."schedule_notification_period_enum"`,
    );
  }
}
