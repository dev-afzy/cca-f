import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "node:path";
import os from "node:os";

const dbPath = path.join(os.homedir(), ".cca-f-tutor", "cca-f.db");
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [concepts, questions, students, masteries] = await Promise.all([
    prisma.concept.count(),
    prisma.question.count(),
    prisma.student.count(),
    prisma.conceptMastery.count(),
  ]);
  console.log({ concepts, questions, students, masteries });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
