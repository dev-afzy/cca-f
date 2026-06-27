import fs from "node:fs";
import path from "node:path";
import { CONCEPT_SEED } from "../src/lib/concept-seed";
import { QUESTION_SEED } from "../src/lib/question-seed";
import { HOUR_TOPICS } from "../src/lib/hour-topics";
import { DOMAIN_LABELS } from "../src/lib/domains";

const errors: string[] = [];
const root = process.cwd();
const curriculum = fs.readFileSync(
  path.join(root, ".claude", "skills", "curriculum.md"),
  "utf8"
);
const stateTemplate = fs.readFileSync(
  path.join(root, ".claude", "skills", "state-template.md"),
  "utf8"
);

// 1. Every question references an existing concept
const slugs = new Set(CONCEPT_SEED.map((c) => c.slug));
for (const q of QUESTION_SEED) {
  if (!slugs.has(q.conceptSlug)) {
    errors.push(`question "${q.slug}" references missing concept "${q.conceptSlug}"`);
  }
}

// 2. Question domain matches its concept's domain
const domainBySlug = new Map(CONCEPT_SEED.map((c) => [c.slug, c.domain]));
for (const q of QUESTION_SEED) {
  const cd = domainBySlug.get(q.conceptSlug);
  if (cd && cd !== q.domain) {
    errors.push(`question "${q.slug}" domain "${q.domain}" != concept domain "${cd}"`);
  }
}

// 3. Concept and question domains are known labels
for (const c of CONCEPT_SEED) {
  if (!(c.domain in DOMAIN_LABELS)) errors.push(`concept "${c.slug}" has unknown domain "${c.domain}"`);
}
for (const q of QUESTION_SEED) {
  if (!(q.domain in DOMAIN_LABELS)) errors.push(`question "${q.slug}" has unknown domain "${q.domain}"`);
}

// 4. HOUR_TOPICS matches curriculum "### Hour N — Title" headings for hours 1-23
for (let h = 1; h <= 23; h++) {
  const m = curriculum.match(new RegExp(`^### Hour ${h} — (.+)$`, "m"));
  if (!m) {
    errors.push(`curriculum.md missing heading "### Hour ${h} — ..."`);
  } else if (m[1].trim() !== HOUR_TOPICS[h]) {
    errors.push(`hour ${h}: curriculum title "${m[1].trim()}" != HOUR_TOPICS "${HOUR_TOPICS[h]}"`);
  }
}

// 5. Every concept name appears in state-template.md (ledger template stays in sync)
for (const c of CONCEPT_SEED) {
  if (!stateTemplate.includes(c.name)) {
    errors.push(`state-template.md missing concept name "${c.name}"`);
  }
}

// 6. Question shape: correctKey exists; distractorReasons covers every option
for (const q of QUESTION_SEED) {
  if (!(q.correctKey in q.options)) errors.push(`question "${q.slug}" correctKey not in options`);
  for (const k of Object.keys(q.options)) {
    if (!(k in q.distractorReasons)) errors.push(`question "${q.slug}" missing distractorReason for ${k}`);
  }
  for (const k of Object.keys(q.distractorReasons)) {
    if (!(k in q.options)) errors.push(`question "${q.slug}" has distractorReason for unknown option ${k}`);
  }
}

// 7. Unique slugs
const qSlugs = QUESTION_SEED.map((q) => q.slug);
const dupeQSlugs = [...new Set(qSlugs.filter((s, i) => qSlugs.indexOf(s) !== i))];
if (dupeQSlugs.length) errors.push(`duplicate question slugs: ${dupeQSlugs.join(", ")}`);
const cSlugs = CONCEPT_SEED.map((c) => c.slug);
const dupeCSlugs = [...new Set(cSlugs.filter((s, i) => cSlugs.indexOf(s) !== i))];
if (dupeCSlugs.length) errors.push(`duplicate concept slugs: ${dupeCSlugs.join(", ")}`);

// 8. difficulty is a known tier
const ALLOWED_DIFFICULTY = new Set(["warmup", "hard"]);
for (const q of QUESTION_SEED) {
  const d = q.difficulty ?? "warmup";
  if (!ALLOWED_DIFFICULTY.has(d)) {
    errors.push(`question "${q.slug}" has unknown difficulty "${d}"`);
  }
}

// Informational: hard-tier coverage per domain (mock draws from hard tier).
const hardByDomain: Record<string, number> = {};
for (const q of QUESTION_SEED) {
  if ((q.difficulty ?? "warmup") === "hard") {
    hardByDomain[q.domain] = (hardByDomain[q.domain] ?? 0) + 1;
  }
}
const hardTotal = Object.values(hardByDomain).reduce((a, b) => a + b, 0);

// 9. The hard bank must be deep enough for two non-overlapping 60-question
// mocks (120 = 2× exam size, per-domain weights doubled).
const HARD_DOMAIN_MIN: Record<string, number> = {
  "Agentic": 32, "Claude Code": 24, "Prompts": 24, "Tool & MCP": 22, "Context": 18,
};
if (hardTotal < 120) errors.push(`hard-tier total ${hardTotal} < 120 (need two non-overlapping mocks' worth)`);
for (const [dom, min] of Object.entries(HARD_DOMAIN_MIN)) {
  const have = hardByDomain[dom] ?? 0;
  if (have < min) errors.push(`hard-tier ${dom}: ${have} < required ${min}`);
}

console.log(`Hard-tier questions: ${hardTotal} total — ${JSON.stringify(hardByDomain)}`);

if (errors.length) {
  console.error(`Content validation FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Content validation passed: ${CONCEPT_SEED.length} concepts, ${QUESTION_SEED.length} questions, 23 hours.`);
