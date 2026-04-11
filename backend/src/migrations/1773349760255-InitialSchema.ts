import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773349760255 implements MigrationInterface {
    name = 'InitialSchema1773349760255'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."vulnerabilities_severity_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`);
        await queryRunner.query(`CREATE TABLE "vulnerabilities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "severity" "public"."vulnerabilities_severity_enum" NOT NULL, "description" text NOT NULL, "remediation" text NOT NULL, "category" character varying(100) NOT NULL, "cve_id" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee96a1a8d70c431bc2d86485502" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scan_findings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "evidence" text, "location" character varying(500) NOT NULL, "raw_output" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scan_id" uuid NOT NULL, "vuln_id" uuid NOT NULL, CONSTRAINT "PK_afa9823e4fb6423e484c58b1aca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ai_analyses_status_enum" AS ENUM('PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TYPE "public"."ai_analyses_risk_level_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`);
        await queryRunner.query(`CREATE TABLE "ai_analyses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."ai_analyses_status_enum" NOT NULL DEFAULT 'PROCESSING', "gemini_model" character varying(100) NOT NULL, "risk_score" integer, "risk_level" "public"."ai_analyses_risk_level_enum", "analysis_text" text, "recommendations" jsonb, "key_findings" jsonb, "attack_vectors" jsonb, "technical_details" text, "compliance_notes" text, "prompt_tokens" integer, "completion_tokens" integer, "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scan_id" uuid NOT NULL, CONSTRAINT "UQ_b9824242036d7b3c51b5d9735d1" UNIQUE ("scan_id"), CONSTRAINT "REL_b9824242036d7b3c51b5d9735d" UNIQUE ("scan_id"), CONSTRAINT "PK_f668f96ca6b8cd3dd8ebbd5c576" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reports_format_enum" AS ENUM('PDF', 'JSON', 'HTML')`);
        await queryRunner.query(`CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "format" "public"."reports_format_enum" NOT NULL, "file_path" character varying(500), "download_url" character varying(1000), "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scan_id" uuid NOT NULL, "created_by" uuid, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."scans_type_enum" AS ENUM('QUICK', 'DEEP')`);
        await queryRunner.query(`CREATE TYPE "public"."scans_status_enum" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "scans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."scans_type_enum" NOT NULL, "status" "public"."scans_status_enum" NOT NULL DEFAULT 'PENDING', "is_scheduled" boolean NOT NULL DEFAULT false, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "asset_id" uuid NOT NULL, "org_id" uuid NOT NULL, "initiated_by" uuid, CONSTRAINT "PK_41156c08314b9e541c1cb18c588" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."scan_schedules_scan_type_enum" AS ENUM('QUICK', 'DEEP')`);
        await queryRunner.query(`CREATE TYPE "public"."scan_schedules_frequency_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY')`);
        await queryRunner.query(`CREATE TABLE "scan_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scan_type" "public"."scan_schedules_scan_type_enum" NOT NULL, "frequency" "public"."scan_schedules_frequency_enum" NOT NULL, "day_of_week" integer, "time_of_day" character varying(5) NOT NULL, "next_run_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "asset_id" uuid NOT NULL, "org_id" uuid NOT NULL, "created_by" uuid, CONSTRAINT "PK_7b26989cba23d1777e1120ed1ec" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."assets_type_enum" AS ENUM('DOMAIN', 'IP', 'URL', 'CIDR')`);
        await queryRunner.query(`CREATE TABLE "assets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "type" "public"."assets_type_enum" NOT NULL, "value" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "org_id" uuid NOT NULL, "created_by" uuid, CONSTRAINT "PK_da96729a8b113377cfb6a62439c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."organization_members_role_enum" AS ENUM('ADMIN', 'EDITOR', 'VIEWER')`);
        await queryRunner.query(`CREATE TABLE "organization_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."organization_members_role_enum" NOT NULL, "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "org_id" uuid NOT NULL, CONSTRAINT "UQ_4e244cb934b550f51edb0f2a5f7" UNIQUE ("user_id", "org_id"), CONSTRAINT "PK_c2b39d5d072886a4d9c8105eb9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('SCAN_COMPLETE', 'SCAN_FAILED', 'AI_ANALYSIS_READY', 'CRITICAL_VULN')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."notifications_type_enum" NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "scan_findings" ADD CONSTRAINT "FK_c8096e5bd2bd9ac8b31377c2923" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scan_findings" ADD CONSTRAINT "FK_a897229e78145b08e42b575ebee" FOREIGN KEY ("vuln_id") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ai_analyses" ADD CONSTRAINT "FK_b9824242036d7b3c51b5d9735d1" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_cb42dd00ac4b15a69d38539fd0f" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_a20814878638f52ffc91005fc42" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scans" ADD CONSTRAINT "FK_d84558542cc889a17d0f64e4794" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scans" ADD CONSTRAINT "FK_b7bfb12c9597e5b602c9ca367a7" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scans" ADD CONSTRAINT "FK_a47e16793ad31b53fb0e26fcc92" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" ADD CONSTRAINT "FK_f919441ca365a1b94021890d620" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" ADD CONSTRAINT "FK_243f82333d3d39190bf58eb3972" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" ADD CONSTRAINT "FK_c2aed59886aa08daa9d4de800e5" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_2252e3011f84cec856454dcdf8c" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assets" ADD CONSTRAINT "FK_dccd1dbe2c036b9ab80876466b7" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_members" ADD CONSTRAINT "FK_89bde91f78d36ca41e9515d91c6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_members" ADD CONSTRAINT "FK_fd8ec3efd79b2ee163cf98edd8c" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "organization_members" DROP CONSTRAINT "FK_fd8ec3efd79b2ee163cf98edd8c"`);
        await queryRunner.query(`ALTER TABLE "organization_members" DROP CONSTRAINT "FK_89bde91f78d36ca41e9515d91c6"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_dccd1dbe2c036b9ab80876466b7"`);
        await queryRunner.query(`ALTER TABLE "assets" DROP CONSTRAINT "FK_2252e3011f84cec856454dcdf8c"`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" DROP CONSTRAINT "FK_c2aed59886aa08daa9d4de800e5"`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" DROP CONSTRAINT "FK_243f82333d3d39190bf58eb3972"`);
        await queryRunner.query(`ALTER TABLE "scan_schedules" DROP CONSTRAINT "FK_f919441ca365a1b94021890d620"`);
        await queryRunner.query(`ALTER TABLE "scans" DROP CONSTRAINT "FK_a47e16793ad31b53fb0e26fcc92"`);
        await queryRunner.query(`ALTER TABLE "scans" DROP CONSTRAINT "FK_b7bfb12c9597e5b602c9ca367a7"`);
        await queryRunner.query(`ALTER TABLE "scans" DROP CONSTRAINT "FK_d84558542cc889a17d0f64e4794"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_a20814878638f52ffc91005fc42"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_cb42dd00ac4b15a69d38539fd0f"`);
        await queryRunner.query(`ALTER TABLE "ai_analyses" DROP CONSTRAINT "FK_b9824242036d7b3c51b5d9735d1"`);
        await queryRunner.query(`ALTER TABLE "scan_findings" DROP CONSTRAINT "FK_a897229e78145b08e42b575ebee"`);
        await queryRunner.query(`ALTER TABLE "scan_findings" DROP CONSTRAINT "FK_c8096e5bd2bd9ac8b31377c2923"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "organization_members"`);
        await queryRunner.query(`DROP TYPE "public"."organization_members_role_enum"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP TABLE "assets"`);
        await queryRunner.query(`DROP TYPE "public"."assets_type_enum"`);
        await queryRunner.query(`DROP TABLE "scan_schedules"`);
        await queryRunner.query(`DROP TYPE "public"."scan_schedules_frequency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."scan_schedules_scan_type_enum"`);
        await queryRunner.query(`DROP TABLE "scans"`);
        await queryRunner.query(`DROP TYPE "public"."scans_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."scans_type_enum"`);
        await queryRunner.query(`DROP TABLE "reports"`);
        await queryRunner.query(`DROP TYPE "public"."reports_format_enum"`);
        await queryRunner.query(`DROP TABLE "ai_analyses"`);
        await queryRunner.query(`DROP TYPE "public"."ai_analyses_risk_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ai_analyses_status_enum"`);
        await queryRunner.query(`DROP TABLE "scan_findings"`);
        await queryRunner.query(`DROP TABLE "vulnerabilities"`);
        await queryRunner.query(`DROP TYPE "public"."vulnerabilities_severity_enum"`);
    }

}
