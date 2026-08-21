export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireUserIdApi } from "@/lib/current-user";
import { restartSprint } from "@/lib/sprint";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { student, masteriesReset } = await restartSprint(userId);
    return NextResponse.json({
      ok: true,
      currentHour: student.currentHour,
      masteriesReset,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/sprint/restart]", msg);
    return NextResponse.json({ error: "restart failed" }, { status: 500 });
  }
}
