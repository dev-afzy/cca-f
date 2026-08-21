# Exam-objective coverage

Reproducible: `npm run grade:coverage` (raise the bar with `COVERAGE_MIN_QS=5`).

Graded against the **30 task statements** of the official *Claude Certified Architect – Foundations
Exam Guide*, **v1.0, July 2026, exam code CCAR-F**.

## Method

Coverage is **taught AND tested** — whether an objective owns its own internal concept row is an
implementation detail; what matters is whether a candidate is taught the mechanism and then tested on it.

| Score | Meaning |
|---|---|
| 1.0 | taught explicitly in `curriculum.md` **and** ≥`COVERAGE_MIN_QS` questions testing it |
| 0.5 | taught explicitly but thin question support, **or** only incidental teaching |
| 0.0 | absent |

Reported unweighted (per objective) and weighted by the official domain weights, since the exam
samples items by domain weight rather than uniformly per objective. Objective→concept ownership is
authored judgement; question counts are measured live from the database, so the grade moves on its
own as content changes.

## Results

| Grade | Bar | Unweighted | Weighted |
|---|---|---|---|
| **Baseline** (2026-08-21, before gap-closing) | ≥3 | 25.5/30 = 85.0% | **85.6%** |
| **After gap-closing** | ≥3 | 30.0/30 = 100.0% | **100.0%** |
| **After gap-closing, strict** | ≥5 | 27.0/30 = 90.0% | **90.3%** |

Average of baseline and post-improvement at the ≥3 bar: **92.8%** weighted.

### What the baseline missed

Five objectives scored below full credit, and an earlier by-eye estimate had put coverage near 93% —
the rigorous grade found two of those objectives had **zero** questions testing them:

| Obj | Objective | Baseline | Why |
|---|---|---|---|
| 1.4 | Multi-step workflows with enforcement and handoff | 0.5 | enforcement taught, handoff only incidental |
| 1.6 | Task decomposition strategies | 0.0 | no concept, no questions |
| 2.5 | Select and apply built-in tools | 0.0 | mentioned in passing in Hour 8 only |
| 5.4 | Context in large-codebase exploration | 0.0 | scattered across Hours 8/16, untested |
| 5.5 | Human review workflows & confidence calibration | 0.0 | split across two concepts, untested |

### What closed them

Four new concepts — `task-decomposition`, `builtin-tool-selection`,
`codebase-exploration-context`, `human-review-calibration` — plus 13 questions and explicit teaching
added to Hours 8, 12, 16 and 17. Bank: 169 → **182** questions, hard tier 134 → **143**.

## Honest limits of this number

- **100% is a floor, not a ceiling.** It means every objective is taught and carries at least three
  questions. It says nothing about whether those questions are *good*, and it is not a pass-rate claim.
- **The rubric is ours.** At a ≥5-question bar the same content scores 90.3%; six objectives are only
  3–4 questions deep (1.6, 2.3, 2.5, 4.6, 5.4, 5.5). Raising those is content work, not a rubric change.
- **Ownership is concept-level, not question-level.** A question is credited to an objective through
  its concept, so a concept spanning two objectives lends its full count to both. Per-question
  objective tagging would be more precise.
- **Zero validated outcomes.** No mock-to-exam correlation exists yet, so coverage is an input measure.
  It does not predict pass probability, and we do not publish one.
