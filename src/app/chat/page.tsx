export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { getOrCreateOpenSession } from "@/lib/tutor/session";
import { requireUserId } from "@/lib/current-user";
import ChatClient from "./ChatClient";
import SignOutButton from "@/app/SignOutButton";

export default async function ChatPage() {
  const userId = await requireUserId();

  const student = await prisma.student.findUnique({
    where: { id: userId },
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

  const session = await getOrCreateOpenSession(userId);

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

  const masterySnapshot = await getMasterySnapshot(userId);

  return (
    <ChatClient
      initialMessages={initialMessages}
      initialMastery={masterySnapshot}
      studentName={student.name || "Student"}
      signOutSlot={
        <SignOutButton className="text-xs px-3 py-1.5 rounded border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors" />
      }
    />
  );
}
