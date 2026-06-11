import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center space-y-6 max-w-sm w-full px-6">
        <div>
          <p className="text-xs tracking-[0.25em] uppercase text-stone-400 dark:text-stone-500 mb-2">
            Claude Certified Architect — Foundations
          </p>
          <h1
            className="text-4xl font-bold text-stone-900 dark:text-stone-100"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            CCA-F Tutor
          </h1>
          <p className="mt-2 text-stone-500 dark:text-stone-400 text-sm">
            23 hours &middot; 4 weeks &middot; adaptive
          </p>
        </div>

        <nav className="flex flex-col gap-3 items-center">
          <Link
            href="/chat"
            className="w-full px-6 py-3 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 rounded font-medium text-sm hover:bg-stone-700 dark:hover:bg-stone-200 transition-colors text-center"
          >
            Start / continue session
          </Link>
          <Link
            href="/ledger"
            className="w-full px-6 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 rounded font-medium text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-center"
          >
            View ledger
          </Link>
        </nav>
      </div>
    </main>
  );
}
