import "server-only";
import { prisma } from "@/lib/prisma";
import type { MasterySnapshot, MasteryEntry } from "@/lib/types";

export async function nudgeMastery(
  studentId: string,
  conceptSlug: string,
  delta: number
): Promise<void> {
  const concept = await prisma.concept.findUnique({
    where: { slug: conceptSlug },
  });
  if (!concept) throw new Error(`Concept slug not found: ${conceptSlug}`);

  const existing = await prisma.conceptMastery.findUnique({
    where: {
      studentId_conceptId: {
        studentId,
        conceptId: concept.id,
      },
    },
  });

  const current = existing?.mastery ?? 0;
  const next = Math.max(0, Math.min(100, current + delta));

  await prisma.conceptMastery.upsert({
    where: {
      studentId_conceptId: {
        studentId,
        conceptId: concept.id,
      },
    },
    create: {
      studentId,
      conceptId: concept.id,
      mastery: next,
      lastTouched: new Date(),
    },
    update: {
      mastery: next,
      lastTouched: new Date(),
    },
  });
}

export async function getMasterySnapshot(
  studentId: string
): Promise<MasterySnapshot> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      currentHour: true,
      preferredStyle: true,
      sprintStartDate: true,
      targetExamDate: true,
      masteries: {
        include: { concept: true },
        orderBy: { concept: { sortOrder: "asc" } },
      },
    },
  });
  if (!student) throw new Error(`Student ${studentId} not found`);

  const now = new Date();
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - student.sprintStartDate.getTime()) / 86400000)
  );
  const daysRemaining = Math.max(
    0,
    Math.floor((student.targetExamDate.getTime() - now.getTime()) / 86400000)
  );

  let preferredStyle: string[] = [];
  try {
    preferredStyle = JSON.parse(student.preferredStyle) as string[];
  } catch {
    // ignore
  }

  const entries: MasteryEntry[] = student.masteries.map((m) => ({
    slug: m.concept.slug,
    name: m.concept.name,
    mastery: m.mastery,
    week: m.concept.week,
    sortOrder: m.concept.sortOrder,
  }));

  return {
    entries,
    currentHour: student.currentHour,
    preferredStyle,
    daysElapsed,
    daysRemaining,
  };
}
