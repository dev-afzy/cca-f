export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyIntent } from "@/lib/router";
import { runTutorLoop, type LoopEvent } from "@/lib/tutor/loop";
import { getOrCreateOpenSession } from "@/lib/tutor/session";
import { buildLedgerSnapshot } from "@/lib/tutor/ledger-snapshot";
import { getMasterySnapshot } from "@/lib/tutor/mastery";
import { syncLedger } from "@/lib/ledger-sync";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { requireUserIdApi } from "@/lib/current-user";

function jsonErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim();
  if (!message) {
    return jsonErrorResponse("message is required", 400);
  }

  const student = await prisma.student.findUnique({
    where: { id: userId },
  });
  if (!student) {
    return jsonErrorResponse("Student not found", 404);
  }

  const session = await getOrCreateOpenSession(userId);

  // Persist user message BEFORE the LLM call so it survives interrupts.
  await prisma.sessionMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: message,
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const recentMessages = await prisma.sessionMessage.findMany({
          where: { sessionId: session.id, role: { in: ["user", "assistant"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
        const dbMessages = recentMessages.reverse();

        const history: MessageParam[] = dbMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const lastAssistant = dbMessages
          .filter((m) => m.role === "assistant")
          .at(-1);
        const assistantTail = lastAssistant?.content ?? "";

        const intent = await classifyIntent({ assistantTail, message });
        const ledgerSnapshot = await buildLedgerSnapshot(userId);

        const loopResult = await runTutorLoop(
          {
            student: { id: userId, currentHour: student.currentHour },
            session: { id: session.id },
            hour: student.currentHour,
            history: history.slice(0, -1),
            intent,
            message,
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
          await syncLedger(userId);
        } catch {
          // non-fatal
        }

        const masterySnapshot = await getMasterySnapshot(userId);
        const freshStudent = await prisma.student.findUnique({
          where: { id: userId },
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
        console.error("[/api/turn]", msg);
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
