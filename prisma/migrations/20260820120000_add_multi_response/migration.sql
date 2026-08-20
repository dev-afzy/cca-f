-- AlterTable
ALTER TABLE "Question" ADD COLUMN "responseCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Question" ADD COLUMN "correctKeys" TEXT;

-- AlterTable
ALTER TABLE "ExamAnswer" ADD COLUMN "chosenKeys" TEXT;
