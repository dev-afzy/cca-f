export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ThemeToggle from "../ThemeToggle";
import SignInButtons from "./SignInButtons";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-6">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="text-center space-y-6 max-w-sm w-full">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-stone-400">Claude Certified Architect — Foundations</p>
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mt-2">CCA-F Tutor</h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Sign in to start your prep.</p>
        </div>
        <div className="flex justify-center"><SignInButtons /></div>
      </div>
    </main>
  );
}
