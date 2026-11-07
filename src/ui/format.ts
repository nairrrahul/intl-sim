import type { ScoreSnap } from "./bracketTypes";

export { POSITION_GROUP } from "../engine/players/positions";

export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatScore(score: ScoreSnap | null): string {
  if (!score) return "–";
  const base = `${score.h}-${score.a}`;
  if (score.ph !== undefined && score.pa !== undefined) return `${base} (${score.ph}-${score.pa} PSO)`;
  return base;
}

/** Strips accents/case so "Jose" matches "José". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** A number with an explicit sign for gains and losses, e.g. "+1.25", "-0.40", "0.00". */
export function signed(value: number, digits = 2): string {
  const text = Math.abs(value).toFixed(digits);
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}
