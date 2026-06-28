import { NextResponse } from "next/server";
import { renderLedger } from "@/lib/ledger-render";
import { requireUserIdApi } from "@/lib/current-user";

export async function GET() {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const md = await renderLedger(userId);
    return new NextResponse(md, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `Error rendering ledger: ${message}\n\nHint: Run npm run db:setup to initialize the database.`,
      { status: 500 }
    );
  }
}
