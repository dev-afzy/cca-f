import { CONCEPT_SEED } from "./concept-seed";

export const CONCEPT_SLUGS = CONCEPT_SEED.map((c) => c.slug);

export type ConceptSlug = (typeof CONCEPT_SLUGS)[number];

export function assertValidSlug(s: string): asserts s is ConceptSlug {
  if (!CONCEPT_SLUGS.includes(s)) {
    throw new Error(
      `Invalid concept slug: "${s}". Valid slugs: ${CONCEPT_SLUGS.join(", ")}`
    );
  }
}
