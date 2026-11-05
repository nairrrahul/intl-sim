import importanceRaw from "./data/match_importance.json";
import { getNationName } from "../nations/nations";
import type { InternationalState } from "./types";

/** FIFA-style match importance coefficients (I in the ranking formula), keyed by match kind. */
export const MATCH_IMPORTANCE = importanceRaw as Record<string, number>;

/** FIFA "SUM" Elo-style ranking: We = 1 / (10^(-dr/600) + 1), where dr is the rating difference. */
export function expectedResult(pointDifference: number): number {
  return 1 / (Math.pow(10, -pointDifference / 600) + 1);
}

export type MatchOutcome = "win" | "draw" | "loss";

/** W: 1 win, 0.5 draw, 0 loss. Matches settled on penalties count 0.75 for the winner and 0.5 for the loser. */
export function resultValue(outcome: MatchOutcome, shootout = false): number {
  if (outcome === "draw") return 0.5;
  if (shootout) return outcome === "win" ? 0.75 : 0.5;
  return outcome === "win" ? 1 : 0;
}

/**
 * P = P_before + I * (W - We). Returns the change for one team.
 * `noPointLoss` implements the rule that teams cannot lose points in World Cup knockout matches.
 */
export function rankingPointChange(
  points: number,
  opponentPoints: number,
  importance: number,
  outcome: MatchOutcome,
  options: { shootout?: boolean; noPointLoss?: boolean } = {}
): number {
  const expected = expectedResult(points - opponentPoints);
  const change = importance * (resultValue(outcome, options.shootout) - expected);
  return options.noPointLoss && change < 0 ? 0 : change;
}

export interface RankRow {
  code: string;
  rank: number;
  points: number;
}

export function computeRankings(state: InternationalState): RankRow[] {
  return Object.values(state.nations)
    .sort((a, b) => b.points - a.points || getNationName(a.code).localeCompare(getNationName(b.code)))
    .map((nation, index) => ({ code: nation.code, rank: index + 1, points: nation.points }));
}

/** Nation code -> current world rank. */
export function getWorldRanks(state: InternationalState): Record<string, number> {
  return Object.fromEntries(computeRankings(state).map(row => [row.code, row.rank]));
}

export interface OverallRankRow {
  code: string;
  rank: number;
  overall: number;
}

/** Nations ranked by their current (actual) squad overall. */
export function computeOverallRankings(state: InternationalState): OverallRankRow[] {
  return Object.values(state.nations)
    .sort((a, b) =>
      b.overall - a.overall ||
      b.points - a.points ||
      getNationName(a.code).localeCompare(getNationName(b.code)))
    .map((nation, index) => ({
      code: nation.code,
      rank: index + 1,
      overall: nation.overall
    }));
}

export interface NationRankingEntry {
  year: number;
  windowId: string;
  label: string;
  rank: number;
  points: number;
}

/** Ranking after each completed window (oldest first). */
export function getNationRankingHistory(state: InternationalState, code: string): NationRankingEntry[] {
  const entries: NationRankingEntry[] = [];
  for (const snapshot of state.rankingHistory) {
    const index = snapshot.ranks.findIndex(([nation]) => nation === code);
    if (index < 0) continue;
    entries.push({
      year: snapshot.year,
      windowId: snapshot.windowId,
      label: snapshot.label,
      rank: index + 1,
      points: snapshot.ranks[index][1]
    });
  }
  return entries;
}
