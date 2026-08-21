export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLedger } from "@/lib/ledger-sync";
import { requireUserIdApi } from "@/lib/current-user";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Find the open session
    const openSession = await prisma.session.findFirst({
      where: { studentId: userId, endedAt: null },
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
      await syncLedger(userId);
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
