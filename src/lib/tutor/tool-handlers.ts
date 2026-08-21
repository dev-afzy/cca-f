import "server-only";
import { prisma } from "@/lib/prisma";
import { assertValidSlug } from "@/lib/concept-slugs";
import { nudgeMastery } from "./mastery";
import { grade } from "./grade";
import { gradeAnswerSet } from "@/lib/exam/score";
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
        const { conceptSlug, difficulty, noRepeat } = input as {
          conceptSlug: string;
          difficulty?: "warmup" | "hard";
          noRepeat?: boolean;
        };
        assertValidSlug(conceptSlug);

        // Structural mock backstop: a session's hour is set by the system at
        // creation, so a mock hour is an authoritative signal the model cannot
        // forget. In a mock hour, DEFAULT difficulty→hard and noRepeat→true when
        // the model omits them, so a forgotten param can't silently leak warmup
        // questions or duplicates into a mock. Explicit values still win, so the
        // model can deliberately fetch warmup / allow-repeat for post-mock
        // remediation.
        const MOCK_HOURS = new Set([7, 14, 22, 23]);
        let inMockHour = false;
        if (ctx.sessionId) {
          const sess = await prisma.session.findUnique({
            where: { id: ctx.sessionId },
            select: { hour: true },
          });
          inMockHour = sess ? MOCK_HOURS.has(sess.hour) : false;
        }
        const effDifficulty = difficulty ?? (inMockHour ? "hard" : undefined);
        const effNoRepeat = noRepeat ?? (inMockHour ? true : false);

        // Questions the student has already attempted (all-time).
        const attempted = await prisma.questionAttempt.findMany({
          where: {
            studentId: ctx.studentId,
            question: { concept: { slug: conceptSlug } },
          },
          select: { questionId: true },
        });
        const seenIds = new Set(attempted.map((a) => a.questionId));

        // In a mock (noRepeat), also exclude anything already fetched THIS
        // session, so a 60-question mock never repeats even before the student
        // has answered.
        if (effNoRepeat && ctx.sessionId) {
          const fetchedThisSession = await prisma.questionFetch.findMany({
            where: { sessionId: ctx.sessionId },
            select: { questionId: true },
          });
          for (const f of fetchedThisSession) seenIds.add(f.questionId);
        }
        const excludeIds = [...seenIds];

        const baseWhere = {
          concept: { slug: conceptSlug },
          ...(effDifficulty ? { difficulty: effDifficulty } : {}),
          // Serve only single-answer questions here. record_attempt accepts one
          // chosenKey, so a multiple-response item (responseCount > 1) could be
          // answered correctly and still grade as wrong — penalising mastery for
          // a right answer. Multiple-response items are exercised in the timed
          // mocks, which pass a full key set to gradeAnswerSet. Remove this
          // filter only once record_attempt takes chosenKeys.
          responseCount: 1,
        };

        // Prefer an unseen question. If none and noRepeat is set, DO NOT
        // re-serve — signal exhaustion so the model generates a fresh one.
        let question = await prisma.question.findFirst({
          where: { ...baseWhere, id: { notIn: excludeIds } },
          orderBy: { id: "asc" },
        });
        if (!question && !effNoRepeat) {
          question = await prisma.question.findFirst({
            where: baseWhere,
            orderBy: { id: "asc" },
          });
        }
        if (!question) {
          return {
            content: JSON.stringify({
              found: false,
              exhausted: true,
              message: `No unseen ${effDifficulty ?? "any"}-tier questions remain for concept "${conceptSlug}". Generate a fresh production-grade question per the exam-realism rubric in question-bank.md, present it, and grade it yourself — do not repeat a prior question.`,
            }),
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
        let permutationJson = "{}";
        if (ctx.sessionId) {
          const fetch = await prisma.questionFetch.findFirst({
            where: { sessionId: ctx.sessionId, questionId },
            orderBy: { createdAt: "desc" },
          });
          if (fetch) {
            permutation = parsePermutation(fetch.permutation);
            permutationJson = fetch.permutation;
          }
        }

        const canonicalChosen = permutation
          ? translateToCanonical(chosenKey, permutation) ?? chosenKey
          : chosenKey;

        const gradeResult = grade(question, canonicalChosen);
        // The tutor's record_attempt tool only ever supplies one chosen
        // letter (no multi-select checkpoint UI yet). Re-grade the
        // correctness bit through the same exact-set helper the exam uses
        // (src/lib/exam/score.ts) so a responseCount > 1 question can never
        // be mis-graded here: wrapping the lone chosenKey in a 1-element
        // array can never set-match a correctKeys array of 2+, so it
        // correctly grades incorrect rather than silently comparing one
        // letter against what is really a partial answer. For a
        // single-answer question (responseCount 1, correctKeys null) this
        // is equivalent to the grade() call above.
        gradeResult.correct = gradeAnswerSet(
          question,
          chosenKey ? [chosenKey] : null,
          permutationJson
        );

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
        const hour = student?.currentHour ?? 0;

        // The hour advances on recorded evidence, never on the model's own
        // judgement that the material was covered. Instructing the tutor to
        // run a checkpoint is probabilistic compliance — the same failure this
        // curriculum teaches in Hour 17 — and in practice it skipped the
        // checkpoint in 13 of 23 hours, which is how a student reaches Hour 23
        // with 34 graded answers and a 90% mastery reading. A wrong answer
        // still counts: the point is measurement, not success.
        const MINI_MOCK_HOURS = [7, 14];
        const FULL_MOCK_HOURS = [22, 23];

        if (FULL_MOCK_HOURS.includes(hour)) {
          // For the mock hours the 60-question timed exam IS the checkpoint.
          // Cumulative so the requirement stays monotonic without tracking
          // when each hour began: Hour 22 needs the first mock, 23 the second.
          const need = hour === 22 ? 1 : 2;
          const have = await prisma.examAttempt.count({
            where: {
              studentId: ctx.studentId,
              status: { in: ["submitted", "expired"] },
            },
          });
          if (have < need) {
            return {
              content: JSON.stringify({
                advanced: false,
                reason: "mock_required",
                hour,
                have,
                need,
                message: `Hour ${hour} requires ${need} completed full mock exam(s); ${have} recorded. Have the student run the 60-question timed mock, then call advance_hour again.`,
              }),
              isError: false,
            };
          }
        } else {
          const need = MINI_MOCK_HOURS.includes(hour) ? 10 : 3;
          const have = await prisma.questionAttempt.count({
            where: { studentId: ctx.studentId, hour },
          });
          if (have < need) {
            return {
              content: JSON.stringify({
                advanced: false,
                reason: "checkpoints_required",
                hour,
                have,
                need,
                message: `Hour ${hour} has ${have} of ${need} recorded checkpoints. Run the remaining ${need - have} with fetch_question + record_attempt before advancing — a wrong answer still counts as evidence.`,
              }),
              isError: false,
            };
          }
        }

        const newHour = Math.min(hour + 1, 23);
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
