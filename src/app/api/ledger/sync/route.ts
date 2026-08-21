import { NextResponse } from "next/server";
import { syncLedger } from "@/lib/ledger-sync";
import { requireUserIdApi } from "@/lib/current-user";

export async function POST() {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLedger(userId);
    return NextResponse.json({ ok: true, path: result.path, bytes: result.bytes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: `Sync failed: ${message}\n\nHint: Run npm run db:setup to initialize the database.`,
      },
      { status: 500 }
    );
  }
}
