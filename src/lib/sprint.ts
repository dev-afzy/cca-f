import "server-only";
import { prisma } from "@/lib/prisma";
import { freshSprintDates } from "@/lib/sprint-dates";

/**
 * Recalibrate the sprint calendar only. Keeps currentHour, mastery, sessions
 * and attempts untouched — for a student whose pace drifted from their actual
 * study cadence (e.g. a multi-day break), not someone starting over.
 */
export async function resyncSprintDates(studentId: string) {
  const { sprintStartDate, targetExamDate } = freshSprintDates();
  return prisma.student.update({
    where: { id: studentId },
    data: { sprintStartDate, targetExamDate },
  });
}

/**
 * Start a new sprint attempt from scratch: currentHour back to 0, every
 * concept's mastery back to 0%, and the calendar reset to today+23 days.
 * Sessions, session messages, exam attempts, friction points and
 * misconceptions are intentionally NOT touched — they remain as the record of
 * the prior attempt. Idempotent: safe to call again on a student already at
 * Hour 0 with 0% mastery.
 */
export async function restartSprint(studentId: string) {
  const { sprintStartDate, targetExamDate } = freshSprintDates();
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.update({
      where: { id: studentId },
      data: { currentHour: 0, sprintStartDate, targetExamDate },
    });
    const { count: masteriesReset } = await tx.conceptMastery.updateMany({
      where: { studentId },
      data: { mastery: 0, lastTouched: null },
    });
    return { student, masteriesReset };
  });
}
