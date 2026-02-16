import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandSportProfilesForOnboarding1739805000000 implements MigrationInterface {
  name = 'ExpandSportProfilesForOnboarding1739805000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumValues = [
      'SWIMMING',
      'RUNNING',
      'MUAY_THAI',
      'BJJ',
      'PADEL',
      'WRESTLING',
      'MMA',
      'KICKBOXING',
      'VOLLEYBALL',
      'TABLE_TENNIS',
    ];

    for (const value of enumValues) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'sport_profiles_sporttype_enum'
              AND e.enumlabel = '${value}'
          ) THEN
            ALTER TYPE "public"."sport_profiles_sporttype_enum" ADD VALUE '${value}';
          END IF;
        END
        $$;
      `);
    }

    await queryRunner.query(
      `ALTER TABLE "sport_profiles" ADD COLUMN IF NOT EXISTS "experienceYears" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sport_profiles" DROP COLUMN IF EXISTS "experienceYears"`,
    );
    // Enum values are not removed in down migration (PostgreSQL enum rollback is destructive).
  }
}
