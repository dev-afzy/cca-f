export const dynamic = "force-dynamic";

import Link from "next/link";
import ThemeToggle from "../ThemeToggle";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/current-user";
import ProviderPicker from "./ProviderPicker";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const student = await prisma.student.findUnique({
    where: { id: userId },
    select: { preferredProvider: true },
  });
  const glmAvailable = Boolean(process.env.GLM_API_KEY);

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/chat" className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400">
            ← Chat
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-xl font-semibold mb-1">Tutor model</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Choose which model runs your tutoring conversations. This does not change the curriculum
          or question bank — both are fixed content, answered by whichever model you pick here.
        </p>
        <ProviderPicker initialProvider={student?.preferredProvider ?? "anthropic"} glmAvailable={glmAvailable} />
      </div>
    </main>
  );
}
