import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { billedMicros as calcBilledMicros } from "@/lib/billing/pricing";
import { ModelUsage } from "@/lib/billing/usage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIAL_MICROS = Number(process.env.CCAF_TRIAL_MICROS ?? 250_000);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Db = Prisma.TransactionClient | typeof prisma;

// ---------------------------------------------------------------------------
// ensureWallet
// ---------------------------------------------------------------------------

/**
 * Idempotent: return existing Wallet for userId or create one with a trial
 * grant. Race-safe: on concurrent-create unique violation (P2002) re-reads and
 * returns the existing wallet.
 */
export async function ensureWallet(
  userId: string,
  db: Db = prisma
): Promise<{ id: number; balanceMicros: number }> {
  const existing = await (db as typeof prisma).wallet.findUnique({
    where: { studentId: userId },
    select: { id: true, balanceMicros: true },
  });
  if (existing) return existing;

  try {
    const wallet = await (db as typeof prisma).wallet.create({
      data: {
        studentId: userId,
        balanceMicros: TRIAL_MICROS,
        lifetimeGrantMicros: TRIAL_MICROS,
        freeTrialGrantedAt: new Date(),
        transactions: {
          create: {
            studentId: userId,
            kind: "trial_grant",
            creditsMicros: TRIAL_MICROS,
            status: "completed",
          },
        },
      },
      select: { id: true, balanceMicros: true },
    });
    return wallet;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Another concurrent call already created the wallet — read it back.
      const race = await (db as typeof prisma).wallet.findUnique({
        where: { studentId: userId },
        select: { id: true, balanceMicros: true },
      });
      if (race) return race;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getBalanceMicros
// ---------------------------------------------------------------------------

/**
 * Returns current balance in micro-dollars, or 0 if no wallet exists yet.
 */
export async function getBalanceMicros(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({
    where: { studentId: userId },
    select: { balanceMicros: true },
  });
  return wallet?.balanceMicros ?? 0;
}

// ---------------------------------------------------------------------------
// chargeTurn
// ---------------------------------------------------------------------------

/**
 * Record a usage event and debit the wallet in one transaction.
 * Balance may go negative (bounded single-turn overdraft — acceptable for v1).
 */
export async function chargeTurn(args: {
  userId: string;
  sessionId: number | null;
  route: string;
  perModel: ModelUsage[];
  stoppedAt: string;
}): Promise<{ billedMicros: number; rawMicros: number; balanceMicros: number }> {
  const { userId, sessionId, route, perModel, stoppedAt } = args;

  const { rawMicros, billedMicros } = calcBilledMicros(perModel);

  // Sum token fields across all perModel entries.
  // Note: ModelUsage.cacheCreationTokens → UsageEvent.cacheWriteTokens
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheWriteTokens = 0;
  let cacheReadTokens = 0;
  for (const m of perModel) {
    inputTokens += m.inputTokens;
    outputTokens += m.outputTokens;
    cacheWriteTokens += m.cacheCreationTokens; // mapping
    cacheReadTokens += m.cacheReadTokens;
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { studentId: userId },
      select: { id: true },
    });

    await tx.usageEvent.create({
      data: {
        walletId: wallet.id,
        studentId: userId,
        sessionId,
        route,
        stoppedAt,
        modelBreakdown: JSON.stringify(perModel),
        inputTokens,
        outputTokens,
        cacheWriteTokens,
        cacheReadTokens,
        rawCostMicros: rawMicros,
        billedMicros,
      },
    });

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceMicros: { decrement: billedMicros },
        lifetimeSpentMicros: { increment: billedMicros },
      },
      select: { balanceMicros: true },
    });

    return updated.balanceMicros;
  });

  return { billedMicros, rawMicros, balanceMicros: result };
}

// ---------------------------------------------------------------------------
// grantCredits
// ---------------------------------------------------------------------------

/**
 * Idempotent credit grant. If a CreditTransaction with the same
 * stripeSessionId / stripeEventId / idempotencyKey already exists, returns
 * alreadyApplied:true without double-crediting. Otherwise credits the wallet
 * and inserts the transaction record in one atomic tx.
 */
export async function grantCredits(args: {
  userId: string;
  creditsMicros: number;
  kind: string;
  amountPaidCents?: number;
  stripeSessionId?: string;
  stripeEventId?: string;
  idempotencyKey?: string;
}): Promise<{ balanceMicros: number; alreadyApplied: boolean }> {
  const {
    userId,
    creditsMicros,
    kind,
    amountPaidCents,
    stripeSessionId,
    stripeEventId,
    idempotencyKey,
  } = args;

  // Check idempotency keys for existing transaction.
  const orClauses: Prisma.CreditTransactionWhereInput[] = [];
  if (stripeSessionId) orClauses.push({ stripeSessionId });
  if (stripeEventId) orClauses.push({ stripeEventId });
  if (idempotencyKey) orClauses.push({ idempotencyKey });

  if (orClauses.length > 0) {
    const existing = await prisma.creditTransaction.findFirst({
      where: { OR: orClauses },
      select: { id: true },
    });
    if (existing) {
      const wallet = await prisma.wallet.findUnique({
        where: { studentId: userId },
        select: { balanceMicros: true },
      });
      return { balanceMicros: wallet?.balanceMicros ?? 0, alreadyApplied: true };
    }
  }

  let balanceMicros: number;
  try {
    balanceMicros = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { studentId: userId },
        select: { id: true },
      });

      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          studentId: userId,
          kind,
          status: "completed",
          amountPaidCents: amountPaidCents ?? 0,
          creditsMicros,
          stripeSessionId,
          stripeEventId,
          idempotencyKey,
        },
      });

      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceMicros: { increment: creditsMicros },
          lifetimeGrantMicros: { increment: creditsMicros },
        },
        select: { balanceMicros: true },
      });

      return updated.balanceMicros;
    });
  } catch (err) {
    // A concurrent duplicate delivery passed the pre-check but was caught by
    // the DB unique index (stripeSessionId / stripeEventId / idempotencyKey).
    // Treat it as already-applied: re-read the current balance and return.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const wallet = await prisma.wallet.findUnique({
        where: { studentId: userId },
        select: { balanceMicros: true },
      });
      return { balanceMicros: wallet?.balanceMicros ?? 0, alreadyApplied: true };
    }
    throw err;
  }

  return { balanceMicros, alreadyApplied: false };
}

// ---------------------------------------------------------------------------
// KILL_SWITCH_ON
// ---------------------------------------------------------------------------

/**
 * Returns true when CCAF_KILL_SWITCH=on. Async signature so a DB-backed flag
 * can replace it later without callers changing.
 */
export async function KILL_SWITCH_ON(): Promise<boolean> {
  return process.env.CCAF_KILL_SWITCH === "on";
}
