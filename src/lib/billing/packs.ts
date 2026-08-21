export type CreditPack = { id: string; label: string; priceCents: number; creditsMicros: number };

export const CREDIT_PACKS: CreditPack[] = [
  { id: "p5",  label: "$5",  priceCents: 500,  creditsMicros: 5_000_000 },
  { id: "p15", label: "$15", priceCents: 1500, creditsMicros: 15_000_000 },
  { id: "p50", label: "$50", priceCents: 5000, creditsMicros: 50_000_000 },
];

export function getPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find(p => p.id === id);
}
