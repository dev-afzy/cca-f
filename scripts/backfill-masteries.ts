/**
 * Backfill missing ConceptMastery rows.
 *
 *   npm run db:backfill-masteries [studentId]
 *
 * Why this exists: `getMasterySnapshot` (src/lib/tutor/mastery.ts) builds the
 * progress view by reading ConceptMastery rows and joining Concept — it does
 * NOT enumerate concepts. `ensureStudent` only seeds mastery rows when it
 * *creates* a student. So when a new concept is added to CONCEPT_SEED, seeding
 * inserts the Concept but every EXISTING student is left without a mastery row,
 * and the new concept is silently invisible in the sidebar and the ledger.
 *
 * Run this after any seed that adds concepts. Idempotent: it only inserts the
 * (student, concept) pairs that are missing, at mastery 0 — never touches an
 * existing row, so real progress is preserved.
 *
 * Pass a studentId to limit the backfill to one student; omit it for all.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";

// Env-driven so this works against hosted Turso in production as well as the
// local SQLite file in dev (mirrors src/lib/prisma.ts).
const tursoUrl = process.env.TURSO_DATABASE_URL;
const adapter = tursoUrl
  ? new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
  : new PrismaLibSql({
      url: `file:${path.join(os.homedir(), ".cca-f-tutor", "cca-f.db")}`,
    });
const prisma = new PrismaClient({ adapter });

const onlyStudentId = process.argv[2];

async function main() {
  const concepts = await prisma.concept.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  if (concepts.length === 0) {
    console.log("No concepts found — run the seed first.");
    return;
  }

  const students = await prisma.student.findMany({
    where: onlyStudentId ? { id: onlyStudentId } : {},
    select: { id: true },
  });
  if (students.length === 0) {
    console.log(
      onlyStudentId
        ? `No student with id "${onlyStudentId}".`
        : "No students found — nothing to backfill."
    );
    return;
  }

  console.log(
    `${concepts.length} concepts × ${students.length} student(s) — checking for gaps...`
  );

  let totalInserted = 0;

  for (const student of students) {
    const existing = await prisma.conceptMastery.findMany({
      where: { studentId: student.id },
      select: { conceptId: true },
    });
    const have = new Set(existing.map((m) => m.conceptId));
    const missing = concepts.filter((c) => !have.has(c.id));

    if (missing.length === 0) {
      console.log(`  ${student.id}: complete (${have.size}/${concepts.length})`);
      continue;
    }

    // Only the missing pairs, so no unique-constraint conflict is possible.
    // (SQLite does not support createMany skipDuplicates under Prisma.)
    await prisma.conceptMastery.createMany({
      data: missing.map((c) => ({
        studentId: student.id,
        conceptId: c.id,
        mastery: 0,
      })),
    });

    totalInserted += missing.length;
    console.log(
      `  ${student.id}: +${missing.length} at 0% → ${missing.map((c) => c.slug).join(", ")}`
    );
  }

  console.log(
    totalInserted === 0
      ? "Nothing to backfill — every student already has every concept."
      : `Backfilled ${totalInserted} mastery row(s) at 0%.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
