import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeEvidenceAndSnapshot1739702400000 implements MigrationInterface {
    name = 'AddDisputeEvidenceAndSnapshot1739702400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`ALTER TABLE "disputes" ADD "subject" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "sport" character varying`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "locationLabel" character varying`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "plaintiffStatement" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "defendantStatement" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "player1RatingBefore" integer`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "player1RatingAfter" integer`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "player2RatingBefore" integer`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "player2RatingAfter" integer`);

        await queryRunner.query(
            `CREATE TYPE "public"."dispute_evidences_type_enum" AS ENUM('VIDEO', 'IMAGE')`,
        );
        await queryRunner.query(
            `CREATE TABLE "dispute_evidences" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "disputeId" uuid NOT NULL,
                "type" "public"."dispute_evidences_type_enum" NOT NULL,
                "url" text NOT NULL,
                "thumbnailUrl" text,
                "durationLabel" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_dispute_evidences_id" PRIMARY KEY ("id")
            )`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_dispute_evidences_disputeId" ON "dispute_evidences" ("disputeId")`,
        );
        await queryRunner.query(
            `ALTER TABLE "dispute_evidences"
             ADD CONSTRAINT "FK_dispute_evidences_disputeId"
             FOREIGN KEY ("disputeId") REFERENCES "disputes"("id")
             ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "dispute_evidences" DROP CONSTRAINT "FK_dispute_evidences_disputeId"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_evidences_disputeId"`);
        await queryRunner.query(`DROP TABLE "dispute_evidences"`);
        await queryRunner.query(`DROP TYPE "public"."dispute_evidences_type_enum"`);

        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "player2RatingAfter"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "player2RatingBefore"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "player1RatingAfter"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "player1RatingBefore"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "defendantStatement"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "plaintiffStatement"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "locationLabel"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "sport"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "subject"`);
    }
}
