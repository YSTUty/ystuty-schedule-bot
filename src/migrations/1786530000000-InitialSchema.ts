import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786530000000 implements MigrationInterface {
  name = 'InitialSchema1786530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_type" "t" INNER JOIN "pg_namespace" "n" ON "n"."oid" = "t"."typnamespace" WHERE "n"."nspname" = 'public' AND "t"."typname" = 'user_role_enum') THEN CREATE TYPE "public"."user_role_enum" AS ENUM('default', 'support', 'admin'); END IF; END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user" ("id" SERIAL NOT NULL, "externalId" integer NOT NULL, "fullname" character varying NOT NULL, "login" character varying(32) NOT NULL, "groupName" character varying(32), "accessToken" character varying(80) NOT NULL, "refreshToken" character varying(80) NOT NULL, "isRewoked" boolean NOT NULL DEFAULT false, "isBanned" boolean NOT NULL DEFAULT false, "role" "public"."user_role_enum" NOT NULL DEFAULT 'default', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_type" "t" INNER JOIN "pg_namespace" "n" ON "n"."oid" = "t"."typnamespace" WHERE "n"."nspname" = 'public' AND "t"."typname" = 'user_social_social_enum') THEN CREATE TYPE "public"."user_social_social_enum" AS ENUM('vkontakte', 'telegram'); END IF; END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_social" ("id" SERIAL NOT NULL, "social" "public"."user_social_social_enum" NOT NULL, "socialId" bigint NOT NULL, "username" character varying(32), "displayname" character varying(64), "profileUrl" character varying(120), "avatarUrl" character varying, "groupName" character varying(16), "isBlockedBot" boolean NOT NULL DEFAULT false, "hasDM" boolean NOT NULL DEFAULT false, "userId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0cd76a8cdee62eeff31d384b730" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_7839ce2222a3c4906f1dc3dab2" ON "user_social" ("social", "socialId")`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_constraint" WHERE "conname" = 'FK_54e0f2285840655ea58a2361ca8') THEN ALTER TABLE "user_social" ADD CONSTRAINT "FK_54e0f2285840655ea58a2361ca8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
    );

    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_type" "t" INNER JOIN "pg_namespace" "n" ON "n"."oid" = "t"."typnamespace" WHERE "n"."nspname" = 'public' AND "t"."typname" = 'conversation_social_enum') THEN CREATE TYPE "public"."conversation_social_enum" AS ENUM('vkontakte', 'telegram'); END IF; END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "conversation" ("id" SERIAL NOT NULL, "social" "public"."conversation_social_enum" NOT NULL, "conversationId" bigint NOT NULL, "title" character varying, "isLeaved" boolean NOT NULL DEFAULT false, "groupName" character varying(16), "invitedByUserSocialId" integer, "chatStatus" character varying(64), "chatType" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_864528ec4274360a40f66c29845" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_717228ec5c2458c2a9a2040f08" ON "conversation" ("social", "conversationId")`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_constraint" WHERE "conname" = 'FK_968e497c9e1bbc2d973af44b11d') THEN ALTER TABLE "conversation" ADD CONSTRAINT "FK_968e497c9e1bbc2d973af44b11d" FOREIGN KEY ("invitedByUserSocialId") REFERENCES "user_social"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_to_conversation" ("conversationId" integer NOT NULL, "userSocialId" integer NOT NULL, CONSTRAINT "PK_d2ba571f48c738d93aaf8c51eb0" PRIMARY KEY ("conversationId", "userSocialId"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d2ba571f48c738d93aaf8c51eb" ON "user_to_conversation" ("conversationId", "userSocialId")`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_constraint" WHERE "conname" = 'FK_ed7ab53a15df7086d3053546057') THEN ALTER TABLE "user_to_conversation" ADD CONSTRAINT "FK_ed7ab53a15df7086d3053546057" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "pg_constraint" WHERE "conname" = 'FK_3ce36341c875badc8c487a59a5e') THEN ALTER TABLE "user_to_conversation" ADD CONSTRAINT "FK_3ce36341c875badc8c487a59a5e" FOREIGN KEY ("userSocialId") REFERENCES "user_social"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Baseline migration marks the existing production schema as applied.
    // Rollback must not drop pre-existing production tables.
    await queryRunner.query(`SELECT 1`);
  }
}
