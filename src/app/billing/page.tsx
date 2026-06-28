import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/current-user";
import ThemeToggle from "../ThemeToggle";
import TopUpButton from "./TopUpButton";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const userId = await requireUserId();

  const [wallet, usageEvents, transactions] = await Promise.all([
    prisma.wallet.findUnique({ where: { studentId: userId } }),
    prisma.usageEvent.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditTransaction.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Header */}
      <header className="border-b-2 border-stone-900 dark:border-stone-700 bg-stone-900 dark:bg-stone-800 text-stone-50">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-stone-400 mb-1">
              Claude Certified Architect — Foundations
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/chat"
              className="text-sm text-stone-400 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              ← Chat
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Balance card */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Balance
          </h2>
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6">
            <div className="text-4xl font-bold font-mono text-amber-600 dark:text-amber-400">
              ${((wallet?.balanceMicros ?? 0) / 1e6).toFixed(2)}
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
              <span>
                granted{" "}
                <span className="font-mono text-stone-700 dark:text-stone-300">
                  ${((wallet?.lifetimeGrantMicros ?? 0) / 1e6).toFixed(2)}
                </span>
              </span>
              <span className="text-stone-300 dark:text-stone-700">|</span>
              <span>
                spent{" "}
                <span className="font-mono text-stone-700 dark:text-stone-300">
                  ${((wallet?.lifetimeSpentMicros ?? 0) / 1e6).toFixed(2)}
                </span>
              </span>
            </div>
            <TopUpButton />
          </div>
        </section>

        {/* Usage table */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            AI Usage (last 50)
          </h2>
          {usageEvents.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">
              No AI usage yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Route</th>
                    <th className="pb-2 pr-4 font-medium">Tokens</th>
                    <th className="pb-2 pr-4 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Stopped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {usageEvents.map((evt) => {
                    const hasCache =
                      evt.cacheReadTokens > 0 || evt.cacheWriteTokens > 0;
                    return (
                      <tr
                        key={evt.id}
                        className="text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900/50"
                      >
                        <td className="py-2 pr-4 font-mono text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                          {evt.createdAt.toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {evt.route}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {evt.inputTokens}/{evt.outputTokens}
                          {hasCache && (
                            <span className="text-stone-400 dark:text-stone-500">
                              {" "}
                              · cache {evt.cacheReadTokens}r/
                              {evt.cacheWriteTokens}w
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-amber-700 dark:text-amber-400">
                          ${(evt.billedMicros / 1e6).toFixed(6)}
                        </td>
                        <td className="py-2 font-mono text-xs text-stone-400 dark:text-stone-500">
                          {evt.stoppedAt ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Purchases & credits table */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 pb-1 mb-4">
            Purchases &amp; Credits (last 50)
          </h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">
              No purchases yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Kind</th>
                    <th className="pb-2 pr-4 font-medium">Paid</th>
                    <th className="pb-2 font-medium">Credited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        {tx.createdAt.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-xs">{tx.kind}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        ${(tx.amountPaidCents / 100).toFixed(2)}
                      </td>
                      <td className="py-2 font-mono text-xs text-amber-700 dark:text-amber-400">
                        ${(tx.creditsMicros / 1e6).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
