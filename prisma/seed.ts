import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
import { CONCEPT_SEED } from "../src/lib/concept-seed";
import { QUESTION_SEED } from "../src/lib/question-seed";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Fresh DBs start the sprint clock today. To reset the clock on an
  // existing student without wiping data, run `npm run db:reset-sprint`.
  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const targetExamDate = new Date(startOfTodayUtc.getTime() + 23 * 86400000);

  console.log("Seeding student...");
  await prisma.student.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "",
      preferredAddress: "",
      background: "",
      prerequisites: "Agent Skills | Claude API | MCP | Claude Code",
      timezone: "",
      preferredStyle: "[]",
      currentHour: 0,
      sprintStartDate: startOfTodayUtc,
      targetExamDate,
      ledgerPath: "~/.cca-f-tutor/student-ledger.md",
    },
    update: {},
  });

  console.log("Seeding concepts...");
  for (const c of CONCEPT_SEED) {
    await prisma.concept.upsert({
      where: { slug: c.slug },
      create: c,
      update: {
        name: c.name,
        week: c.week,
        domain: c.domain,
        sortOrder: c.sortOrder,
      },
    });
  }

  console.log("Seeding concept masteries...");
  const allConcepts = await prisma.concept.findMany();
  for (const concept of allConcepts) {
    await prisma.conceptMastery.upsert({
      where: {
        studentId_conceptId: { studentId: "default", conceptId: concept.id },
      },
      create: {
        studentId: "default",
        conceptId: concept.id,
        mastery: 0,
        lastTouched: null,
      },
      update: {},
    });
  }

  console.log("Seeding questions...");
  for (const q of QUESTION_SEED) {
    const concept = await prisma.concept.findUnique({
      where: { slug: q.conceptSlug },
    });

    await prisma.question.upsert({
      where: { slug: q.slug },
      create: {
        slug: q.slug,
        conceptId: concept?.id ?? null,
        domain: q.domain,
        stem: q.stem,
        options: JSON.stringify(q.options),
        correctKey: q.correctKey,
        distractorReasons: JSON.stringify(q.distractorReasons),
        source: "hand-authored",
      },
      update: {
        conceptId: concept?.id ?? null,
        domain: q.domain,
        stem: q.stem,
        options: JSON.stringify(q.options),
        correctKey: q.correctKey,
        distractorReasons: JSON.stringify(q.distractorReasons),
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
