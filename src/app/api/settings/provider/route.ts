export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserIdApi } from "@/lib/current-user";

const KNOWN_PROVIDERS = new Set(["anthropic", "glm"]);

export async function POST(req: Request) {
  const userId = await requireUserIdApi();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  if (typeof provider !== "string" || !KNOWN_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (provider === "glm" && !process.env.GLM_API_KEY?.trim()) {
    return NextResponse.json({ error: "glm_not_configured" }, { status: 400 });
  }

  await prisma.student.update({
    where: { id: userId },
    data: { preferredProvider: provider },
  });

  return NextResponse.json({ ok: true, provider });
}
