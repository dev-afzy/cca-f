export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { getOrCreateOpenSession } from "@/lib/tutor/session";
import ChatClient from "./ChatClient";

const STUDENT_ID = "default";

export default async function ChatPage() {
  const student = await prisma.student.findUnique({
    where: { id: STUDENT_ID },
  });

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">
          Student record not found. Run <code>npm run db:setup</code> first.
        </p>
      </div>
    );
  }

  const session = await getOrCreateOpenSession(STUDENT_ID);

  // Load existing messages from this session
  const dbMessages = await prisma.sessionMessage.findMany({
    where: { sessionId: session.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
  });

  const initialMessages = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    id: m.id,
    stoppedAt: m.content.includes("(tutor exceeded tool budget")
      ? ("iteration_cap" as const)
      : undefined,
  }));

  const masterySnapshot = await getMasterySnapshot(STUDENT_ID);

  return (
    <ChatClient
      initialMessages={initialMessages}
      initialMastery={masterySnapshot}
      studentName={student.name || "Student"}
    />
  );
}
