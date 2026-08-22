-- prisma/migrations/20260822120000_add_student_preferred_provider/migration.sql
ALTER TABLE "Student" ADD COLUMN "preferredProvider" TEXT NOT NULL DEFAULT 'anthropic';
