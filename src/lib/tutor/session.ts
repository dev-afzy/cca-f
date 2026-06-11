import "server-only";
import { prisma } from "@/lib/prisma";
import { HOUR_TOPICS } from "@/lib/hour-topics";
import type { Session } from "@prisma/client";

export async function getOrCreateOpenSession(
  studentId: string
): Promise<Session> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { currentHour: true },
  });
  if (!student) throw new Error(`Student ${studentId} not found`);

  const currentHour = student.currentHour;

  // Look for any open session for this student
  const existing = await prisma.session.findFirst({
    where: {
      studentId,
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  if (existing) return existing;

  const topic = HOUR_TOPICS[currentHour] ?? `Hour ${currentHour}`;

  return prisma.session.create({
    data: {
      studentId,
      hour: currentHour,
      topic,
    },
  });
}

export async function closeSession(
  sessionId: number,
  outcome: string
): Promise<{ wasAlreadyClosed: boolean }> {
  // Check first so we never overwrite an existing endedAt timestamp
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { endedAt: true },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (session.endedAt !== null) {
    return { wasAlreadyClosed: true };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      outcome,
      endedAt: new Date(),
    },
  });

  return { wasAlreadyClosed: false };
}
