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

if (errors.length) {
  console.error(`Content validation FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Content validation passed: ${CONCEPT_SEED.length} concepts, ${QUESTION_SEED.length} questions, 23 hours.`);
