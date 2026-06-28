import "server-only";
import { prisma } from "@/lib/prisma";

const SPRINT_DAYS = 23;

/**
 * Make sure a Student profile exists for this authenticated user.
 * Idempotent. On the very first sign-in, if the legacy unclaimed
 * Student id="default" exists, re-key it to this user (FKs cascade on update);
 * otherwise create a fresh Student with 0% masteries for every concept.
 */
export async function ensureStudent(userId: string): Promise<void> {
  const existing = await prisma.student.findUnique({ where: { id: userId } });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    // Re-check inside the tx to avoid a race between two simultaneous first logins.
    if (await tx.student.findUnique({ where: { id: userId } })) return;

    const def = await tx.student.findUnique({ where: { id: "default" } });
    if (def) {
      await tx.student.update({ where: { id: "default" }, data: { id: userId } });
      return;
    }

    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const targetExamDate = new Date(startOfTodayUtc.getTime() + SPRINT_DAYS * 86400000);
    await tx.student.create({
      data: { id: userId, sprintStartDate: startOfTodayUtc, targetExamDate },
    });
    const concepts = await tx.concept.findMany({ select: { id: true } });
    if (concepts.length) {
      await tx.conceptMastery.createMany({
        data: concepts.map((c) => ({ studentId: userId, conceptId: c.id, mastery: 0 })),
      });
    }
  });
}
