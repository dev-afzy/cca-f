export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLedger } from "@/lib/ledger-sync";

const STUDENT_ID = "default";

export async function POST() {
  try {
    // Find the open session
    const openSession = await prisma.session.findFirst({
      where: { studentId: STUDENT_ID, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (openSession) {
      await prisma.session.update({
        where: { id: openSession.id },
        data: { endedAt: new Date() },
      });
    }

    // Sync ledger
    try {
      await syncLedger(STUDENT_ID);
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/session/end]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
