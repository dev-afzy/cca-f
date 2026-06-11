import "server-only";
import { prisma } from "@/lib/prisma";
import { assertValidSlug } from "@/lib/concept-slugs";
import { nudgeMastery } from "./mastery";
import { grade } from "./grade";
import { getOrCreateOpenSession, closeSession } from "./session";
import { buildLedgerSnapshot } from "./ledger-snapshot";
import {
  shuffleOptions,
  parsePermutation,
  translateToCanonical,
  invertPermutation,
  remapByPermutation,
  isOptionKey,
  type CanonicalOptions,
} from "./shuffle";

export type ToolContext = {
  studentId: string;
  sessionId: number | null;
};

type ToolResult = {
  content: string;
  isError: boolean;
};

export async function executeTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case "read_ledger": {
        const snapshot = await buildLedgerSnapshot(ctx.studentId);
        const student = await prisma.student.findUnique({
          where: { id: ctx.studentId },
          select: { name: true, background: true, preferredStyle: true, currentHour: true },
        });
        const recentFriction = await prisma.frictionPoint.findMany({
          where: { studentId: ctx.studentId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { concept: true },
        });
        const recentMisconceptions = await prisma.misconception.findMany({
          where: { studentId: ctx.studentId, resolvedAt: null },
          orderBy: { openedAt: "desc" },
          take: 5,
        });

        return {
          content: JSON.stringify({
            profile: {
              name: student?.name,
              background: student?.background,
            },
            mastery: snapshot.masteryTable,
            recentFriction: recentFriction.map((fp) => ({
              id: fp.id,
              description: fp.description,
              concept: fp.concept?.slug ?? null,
              hour: fp.hour,
              resolved: fp.resolved,
            })),
            activeMisconceptions: recentMisconceptions.map((m) => ({
              id: m.id,
              belief: m.belief,
            })),
            recentSessions: snapshot.recentSessionList,
            preferredStyle: snapshot.preferredStyle,
            currentHour: snapshot.currentHour,
            daysElapsed: snapshot.daysElapsed,
            daysRemaining: snapshot.daysRemaining,
          }),
          isError: false,
        };
      }

      case "start_session": {
        const session = await getOrCreateOpenSession(ctx.studentId);
        ctx.sessionId = session.id;
        return {
          content: JSON.stringify({ sessionId: session.id }),
          isError: false,
        };
      }

      case "end_session": {
        const { summaryMd, growthArea } = input as {
          summaryMd: string;
          growthArea: string;
        };
        const sessionId = ctx.sessionId;
        if (!sessionId) {
          return { content: "No active session to end.", isError: true };
        }
        const outcome = `${summaryMd}\n\nGrowth Area: ${growthArea}`;
        await closeSession(sessionId, outcome);
        return { content: JSON.stringify({ ok: true }), isError: false };
      }

      case "update_mastery": {
        const { conceptSlug, newPct } = input as {
          conceptSlug: string;
          newPct: number;
        };
        assertValidSlug(conceptSlug);
        const concept = await prisma.concept.findUnique({
          where: { slug: conceptSlug },
        });
        if (!concept) {
          return { content: `Concept not found: ${conceptSlug}`, isError: true };
        }
        const clamped = Math.max(0, Math.min(100, Math.round(newPct)));
        await prisma.conceptMastery.upsert({
          where: {
            studentId_conceptId: {
              studentId: ctx.studentId,
              conceptId: concept.id,
            },
          },
          create: {
            studentId: ctx.studentId,
            conceptId: concept.id,
            mastery: clamped,
            lastTouched: new Date(),
          },
          update: {
            mastery: clamped,
            lastTouched: new Date(),
          },
        });
        return {
          content: JSON.stringify({ ok: true, conceptSlug, mastery: clamped }),
          isError: false,
        };
      }

      case "log_friction": {
        const { conceptSlug, description, styleNote } = input as {
          conceptSlug?: string;
          description: string;
          styleNote?: string;
        };

        let conceptId: number | null = null;
        if (conceptSlug) {
          assertValidSlug(conceptSlug);
          const concept = await prisma.concept.findUnique({
            where: { slug: conceptSlug },
          });
          conceptId = concept?.id ?? null;
        }

        const student = await prisma.student.findUnique({
          where: { id: ctx.studentId },
          select: { currentHour: true },
        });

        const fp = await prisma.frictionPoint.create({
          data: {
            studentId: ctx.studentId,
            conceptId,
            sessionId: ctx.sessionId,
            hour: student?.currentHour ?? 0,
            description,
            styleNote: styleNote ?? "",
          },
        });
        return {
          content: JSON.stringify({ ok: true, frictionPointId: fp.id }),
          isError: false,
        };
      }

      case "log_misconception": {
        const { belief } = input as { belief: string };
        const m = await prisma.misconception.create({
          data: {
            studentId: ctx.studentId,
            belief,
          },
        });
        return {
          content: JSON.stringify({ ok: true, misconceptionId: m.id }),
          isError: false,
        };
      }

      case "close_misconception": {
        const { misconceptionId } = input as { misconceptionId: number };
        await prisma.misconception.update({
          where: { id: misconceptionId },
          data: { resolvedAt: new Date() },
        });
        return {
          content: JSON.stringify({ ok: true }),
          isError: false,
        };
      }

      case "mark_strong_area": {
        const { conceptSlug } = input as { conceptSlug: string };
        assertValidSlug(conceptSlug);
        const concept = await prisma.concept.findUnique({
          where: { slug: conceptSlug },
        });
        if (!concept) {
          return { content: `Concept not found: ${conceptSlug}`, isError: true };
        }
        await prisma.strongArea.upsert({
          where: {
            studentId_conceptId: {
              studentId: ctx.studentId,
              conceptId: concept.id,
            },
          },
          create: {
            studentId: ctx.studentId,
            conceptId: concept.id,
          },
          update: {},
        });
        return {
          content: JSON.stringify({ ok: true, conceptSlug }),
          isError: false,
        };
      }

      case "fetch_question": {
        const { conceptSlug } = input as { conceptSlug: string };
        assertValidSlug(conceptSlug);

        // Serve a question the student hasn't attempted yet for this concept,
        // so a multi-question concept rotates through its whole bank instead
        // of always returning the first row. Once every question has been
        // seen, fall back to the full set (lowest id) and re-serve.
        const attempted = await prisma.questionAttempt.findMany({
          where: {
            studentId: ctx.studentId,
            question: { concept: { slug: conceptSlug } },
          },
          select: { questionId: true },
        });
        const attemptedIds = attempted.map((a) => a.questionId);

        const question =
          (await prisma.question.findFirst({
            where: {
              concept: { slug: conceptSlug },
              id: { notIn: attemptedIds },
            },
            orderBy: { id: "asc" },
          })) ??
          (await prisma.question.findFirst({
            where: { concept: { slug: conceptSlug } },
            orderBy: { id: "asc" },
          }));
        if (!question) {
          return {
            content: JSON.stringify({ found: false }),
            isError: false,
          };
        }
        // Options are stored as a JSON object {A,B,C,D} → strings. Parse,
        // shuffle, and persist the permutation so record_attempt can grade
        // against the canonical key later.
        let canonical: CanonicalOptions | null = null;
        try {
          const parsed = JSON.parse(question.options) as Record<string, unknown>;
          if (
            typeof parsed.A === "string" &&
            typeof parsed.B === "string" &&
            typeof parsed.C === "string" &&
            typeof parsed.D === "string"
          ) {
            canonical = {
              A: parsed.A,
              B: parsed.B,
              C: parsed.C,
              D: parsed.D,
            };
          }
        } catch {
          // malformed bank entry — fall through to identity behavior
        }

        if (!canonical || !ctx.sessionId) {
          // No shuffle possible (malformed options OR no session to scope the
          // permutation against). Return raw and let record_attempt fall back
          // to canonical grading.
          let raw: unknown = {};
          try {
            raw = JSON.parse(question.options);
          } catch {
            raw = question.options;
          }
          return {
            content: JSON.stringify({
              found: true,
              questionId: question.id,
              stem: question.stem,
              options: raw,
            }),
            isError: false,
          };
        }

        const { shuffled, permutation } = shuffleOptions(canonical);
        await prisma.questionFetch.create({
          data: {
            sessionId: ctx.sessionId,
            questionId: question.id,
            permutation: JSON.stringify(permutation),
          },
        });

        return {
          content: JSON.stringify({
            found: true,
            questionId: question.id,
            stem: question.stem,
            options: shuffled,
          }),
          isError: false,
        };
      }

      case "record_attempt": {
        const { questionId, chosenKey, reasoning } = input as {
          questionId: number;
          chosenKey: string;
          reasoning?: string;
        };
        const question = await prisma.question.findUnique({
          where: { id: questionId },
          include: { concept: true },
        });
        if (!question) {
          return { content: `Question ${questionId} not found.`, isError: true };
        }
        const student = await prisma.student.findUnique({
          where: { id: ctx.studentId },
          select: { currentHour: true },
        });

        // Resolve the shuffle: if fetch_question was called for this
        // (sessionId, questionId), translate the student's shuffled-letter
        // answer back to the canonical letter before grading. The latest fetch
        // wins — model behavior is fetch → present → answer in tight order, so
        // staleness is not a real concern.
        let permutation = null;
        if (ctx.sessionId) {
          const fetch = await prisma.questionFetch.findFirst({
            where: { sessionId: ctx.sessionId, questionId },
            orderBy: { createdAt: "desc" },
          });
          if (fetch) permutation = parsePermutation(fetch.permutation);
        }

        const canonicalChosen = permutation
          ? translateToCanonical(chosenKey, permutation) ?? chosenKey
          : chosenKey;

        const gradeResult = grade(question, canonicalChosen);

        await prisma.questionAttempt.create({
          data: {
            studentId: ctx.studentId,
            questionId,
            sessionId: ctx.sessionId,
            hour: student?.currentHour ?? 0,
            // Persist the SHUFFLED key the student actually saw + clicked, so
            // an audit ("they picked B") reflects what was on screen, not the
            // bank's internal letter. Grading correctness is unaffected.
            chosenKey: isOptionKey(chosenKey) ? chosenKey : canonicalChosen,
            correct: gradeResult.correct,
            reasoning: reasoning ?? "",
          },
        });

        if (question.concept) {
          await nudgeMastery(
            ctx.studentId,
            question.concept.slug,
            gradeResult.correct ? 5 : -5
          );
        }

        // Remap the grader's canonical correctKey + distractorReasons to the
        // shuffled letters so the model can say "the correct answer was X"
        // using the same letter the student actually saw on screen.
        const shuffledCorrectKey = permutation
          ? invertPermutation(permutation)[gradeResult.correctKey as "A" | "B" | "C" | "D"] ?? gradeResult.correctKey
          : gradeResult.correctKey;
        const shuffledDistractors = permutation
          ? remapByPermutation(gradeResult.distractorReasons as Record<string, unknown>, permutation)
          : gradeResult.distractorReasons;

        return {
          content: JSON.stringify({
            correct: gradeResult.correct,
            correctKey: shuffledCorrectKey,
            distractorReasons: shuffledDistractors,
          }),
          isError: false,
        };
      }

      case "advance_hour": {
        const student = await prisma.student.findUnique({
          where: { id: ctx.studentId },
          select: { currentHour: true },
        });
        const newHour = Math.min((student?.currentHour ?? 0) + 1, 23);
        await prisma.student.update({
          where: { id: ctx.studentId },
          data: { currentHour: newHour },
        });
        return {
          content: JSON.stringify({ ok: true, currentHour: newHour }),
          isError: false,
        };
      }

      case "set_preferred_style": {
        const { tags } = input as { tags: string[] };
        await prisma.student.update({
          where: { id: ctx.studentId },
          data: { preferredStyle: JSON.stringify(tags) },
        });
        return {
          content: JSON.stringify({ ok: true, tags }),
          isError: false,
        };
      }

      default:
        return {
          content: `Unknown tool: ${name}`,
          isError: true,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Tool ${name} error: ${msg}`, isError: true };
  }
}
