import { NextResponse } from "next/server";
import { renderLedger } from "@/lib/ledger-render";

export async function GET() {
  try {
    const md = await renderLedger("default");
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
