"use client";

import { useState } from "react";
import TopUpModal from "../chat/TopUpModal";

export default function TopUpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
      >
        Top up
      </button>
      <TopUpModal
        open={open}
        reason="Add credits"
        onClose={() => setOpen(false)}
      />
    </>
  );
}
