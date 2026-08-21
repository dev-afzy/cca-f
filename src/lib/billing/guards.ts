import "server-only";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// startOfTodayUtc
// ---------------------------------------------------------------------------

/**
 * Returns midnight UTC for the current day — the boundary used for all daily
 * aggregations. Pattern mirrors src/lib/ensure-student.ts.
 */
export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

// ---------------------------------------------------------------------------
// dailyUserSpendMicros
// ---------------------------------------------------------------------------

/**
 * Sum of billedMicros for userId since the start of today UTC.
 */
export async function dailyUserSpendMicros(userId: string): Promise<number> {
  const result = await prisma.usageEvent.aggregate({
    where: {
      studentId: userId,
      createdAt: { gte: startOfTodayUtc() },
    },
    _sum: { billedMicros: true },
  });
  return result._sum.billedMicros ?? 0;
}

// ---------------------------------------------------------------------------
// globalDailyRawMicros
// ---------------------------------------------------------------------------

/**
 * Sum of rawCostMicros across ALL users since the start of today UTC.
 * Tracks owner (at-cost) spend, not marked-up billed amounts.
 */
export async function globalDailyRawMicros(): Promise<number> {
  const result = await prisma.usageEvent.aggregate({
    where: {
      createdAt: { gte: startOfTodayUtc() },
    },
    _sum: { rawCostMicros: true },
  });
  return result._sum.rawCostMicros ?? 0;
}

// ---------------------------------------------------------------------------
// Cap checks
// ---------------------------------------------------------------------------

/**
 * True when a user's daily billed spend meets or exceeds the per-user cap.
 * Default cap: 3,000,000 µ$ (= $3.00).
 */
export async function overDailyUserCap(userId: string): Promise<boolean> {
  const cap = Number(process.env.CCAF_DAILY_USER_CAP_MICROS ?? 3_000_000);
  const spent = await dailyUserSpendMicros(userId);
  return spent >= cap;
}

/**
 * True when global daily raw spend meets or exceeds the owner-level cap.
 * Default cap: 25,000,000 µ$ (= $25.00).
 */
export async function overGlobalCap(): Promise<boolean> {
  const cap = Number(process.env.CCAF_GLOBAL_DAILY_CAP_MICROS ?? 25_000_000);
  const spent = await globalDailyRawMicros();
  return spent >= cap;
}
