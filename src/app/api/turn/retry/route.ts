export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { classifyIntent } from "@/lib/router";
import { runTutorLoop, type LoopEvent } from "@/lib/tutor/loop";
import { getOrCreateOpenSession } from "@/lib/tutor/session";
import { buildLedgerSnapshot } from "@/lib/tutor/ledger-snapshot";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { syncLedger } from "@/lib/ledger-sync";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const STUDENT_ID = "default";

function jsonErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST() {
  const student = await prisma.student.findUnique({
    where: { id: STUDENT_ID },
  });
  if (!student) {
    return jsonErrorResponse("Student not found", 404);
  }

  const session = await getOrCreateOpenSession(STUDENT_ID);

  // Drop trailing assistant + tool log messages from the failed attempt so the
  // history ends on the user turn we're retrying.
  const trailingMessages = await prisma.sessionMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const toDeleteIds: number[] = [];
  for (const m of trailingMessages) {
    if (m.role === "user") break;
    toDeleteIds.push(m.id);
  }
  if (toDeleteIds.length > 0) {
    await prisma.sessionMessage.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
  }

  const recentMessages = await prisma.sessionMessage.findMany({
    where: { sessionId: session.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const dbMessages = recentMessages.reverse();

  if (dbMessages.length === 0 || dbMessages.at(-1)?.role !== "user") {
    return jsonErrorResponse("Nothing to retry — no pending user turn.", 400);
  }

  const lastUserMessage = dbMessages.at(-1)!.content;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const history: MessageParam[] = dbMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const lastAssistant = dbMessages
          .filter((m) => m.role === "assistant")
          .at(-1);
        const assistantTail = lastAssistant?.content ?? "";

        const intent = await classifyIntent({
          assistantTail,
          message: lastUserMessage,
        });
        const ledgerSnapshot = await buildLedgerSnapshot(STUDENT_ID);

        const loopResult = await runTutorLoop(
          {
            student: { id: STUDENT_ID, currentHour: student.currentHour },
            session: { id: session.id },
            hour: student.currentHour,
            history: history.slice(0, -1),
            intent,
            message: lastUserMessage,
            ledgerSnapshot,
          },
          (event: LoopEvent) => send(event)
        );

        await prisma.sessionMessage.create({
          data: {
            sessionId: session.id,
            role: "assistant",
            content: loopResult.assistantText,
          },
        });

        if (loopResult.toolCalls.length > 0) {
          await prisma.sessionMessage.create({
            data: {
              sessionId: session.id,
              role: "tool",
              content: JSON.stringify(loopResult.toolCalls),
            },
          });
        }

        try {
          await syncLedger(STUDENT_ID);
        } catch {
          // non-fatal
        }

        const masterySnapshot = await getMasterySnapshot(STUDENT_ID);
        const freshStudent = await prisma.student.findUnique({
          where: { id: STUDENT_ID },
          select: { currentHour: true },
        });

        send({
          type: "done",
          message: loopResult.assistantText,
          intent,
          masterySnapshot,
          toolsCalled: loopResult.toolCalls.map((t) => t.name),
          currentHour: freshStudent?.currentHour ?? student.currentHour,
          stoppedAt: loopResult.stoppedAt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/turn/retry]", msg);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
