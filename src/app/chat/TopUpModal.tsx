"use client";

import { useState } from "react";
import { CREDIT_PACKS } from "@/lib/billing/packs";

type TopUpModalProps = {
  open: boolean;
  onClose: () => void;
  reason?: string;
};

export default function TopUpModal({ open, onClose, reason }: TopUpModalProps) {
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleBuy = async (packId: string) => {
    if (loadingPackId) return;
    setError(null);
    setLoadingPackId(packId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoadingPackId(null);
        setError("Couldn't start checkout. Please try again.");
      }
    } catch {
      setLoadingPackId(null);
      setError("Couldn't start checkout. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Heading */}
        <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1">
          Top up credits
        </h2>

        {/* Reason text */}
        {reason && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {reason}
          </p>
        )}

        {/* Pack buttons */}
        <div className="flex flex-col gap-3 mt-2">
          {CREDIT_PACKS.map((pack) => {
            const isLoading = loadingPackId === pack.id;
            const isDisabled = loadingPackId !== null;
            return (
              <button
                key={pack.id}
                onClick={() => void handleBuy(pack.id)}
                disabled={isDisabled}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 dark:hover:border-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                <div className="text-left">
                  <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {pack.label} credits
                  </span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    ${(pack.creditsMicros / 1e6).toFixed(0)} of tutor time
                  </span>
                </div>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400 group-hover:text-amber-800 dark:group-hover:text-amber-300 flex items-center gap-1.5">
                  {isLoading ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h-4z" />
                    </svg>
                  ) : (
                    <>
                      Buy {pack.label}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-400 text-center">
            {error}
          </p>
        )}

        <p className="mt-4 text-[11px] text-stone-400 dark:text-stone-500 text-center">
          Secure checkout via Stripe. Credits are applied instantly after payment.
        </p>
      </div>
    </div>
  );
}
