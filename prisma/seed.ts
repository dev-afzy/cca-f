import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";
import { CONCEPT_SEED } from "../src/lib/concept-seed";
import { QUESTION_SEED } from "../src/lib/question-seed";

// Concepts/questions removed from the exam-aligned curriculum. Deleting the
// concept cascades its masteries; FrictionPoint keeps its text with a null
// concept. Deleting a question cascades its attempts.
const RETIRED_CONCEPT_SLUGS = [
  "token-mechanics-cost",
  "stateful-tools-security",
  "agent-pattern-router",
  "data-privacy-pii",
  "prompt-injection",
  "prompt-caching",
  "error-handling-resp",
];
const RETIRED_QUESTION_SLUGS = ["prompt-caching-breakpoint-placement"];

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Student profiles are created per-user at first login (see ensure-student.ts).

  console.log("Retiring out-of-scope concepts/questions...");
  await prisma.question.deleteMany({
    where: { slug: { in: RETIRED_QUESTION_SLUGS } },
  });
  await prisma.concept.deleteMany({
    where: { slug: { in: RETIRED_CONCEPT_SLUGS } },
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

  console.log("Seeding questions...");
  for (const q of QUESTION_SEED) {
    const concept = await prisma.concept.findUnique({
      where: { slug: q.conceptSlug },
    });

    const responseCount = q.responseCount ?? 1;
    const correctKeys = q.correctKeys ? JSON.stringify(q.correctKeys) : null;

    await prisma.question.upsert({
      where: { slug: q.slug },
      create: {
        slug: q.slug,
        conceptId: concept?.id ?? null,
        domain: q.domain,
        stem: q.stem,
        options: JSON.stringify(q.options),
        correctKey: q.correctKey,
        responseCount,
        correctKeys,
        distractorReasons: JSON.stringify(q.distractorReasons),
        source: "hand-authored",
        difficulty: q.difficulty ?? "warmup",
      },
      update: {
        conceptId: concept?.id ?? null,
        domain: q.domain,
        stem: q.stem,
        options: JSON.stringify(q.options),
        correctKey: q.correctKey,
        responseCount,
        correctKeys,
        distractorReasons: JSON.stringify(q.distractorReasons),
        difficulty: q.difficulty ?? "warmup",
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
