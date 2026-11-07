import type { InternationalMatch } from "../engine/international/types";

/** Plain-data view types shared by the bracket and cup components. */

export interface TeamRef {
  id: number;
  name: string;
  countrycode?: string | null;
}

export interface ScoreSnap {
  h: number;
  a: number;
  /** Penalty shootout goals (home / away), only when decided on penalties. */
  ph?: number;
  pa?: number;
}

export interface CupMatchSnap {
  id: string;
  home: TeamRef | null;
  away: TeamRef | null;
  score: ScoreSnap | null;
  winner: TeamRef | null;
  bye: boolean;
  legs?: [ScoreSnap | null, ScoreSnap | null];
  aggregate?: { h: number; a: number } | null;
  tiebreak?: ScoreSnap | null;
  /** The live fixture behind a single-leg match (lets God Mode rig it and the report open on click). */
  fixture?: InternationalMatch;
  /** Every played leg, for a two-legged tie. */
  fixtures?: InternationalMatch[];
}

export interface CupRoundSnap {
  round: number;
  label: string;
  /** Matchday of the window the round is played on. */
  matchday: number;
  matches: CupMatchSnap[];
}

export interface CupSnap {
  rounds: CupRoundSnap[];
  complete: boolean;
  winner: TeamRef | null;
  runnerUp: TeamRef | null;
}

export interface EuroTieSnap {
  id: string;
  home: TeamRef | null;
  away: TeamRef | null;
  bye: boolean;
  legs: { matchday: number; score: ScoreSnap }[];
  aggregate: { h: number; a: number } | null;
  tiebreak: ScoreSnap | null;
  winner: TeamRef | null;
  /** The tie's legs (first, then second), so the report can open on click. */
  fixtures?: InternationalMatch[];
}

export interface EuroRoundSnap {
  key: string;
  label: string;
  matchdays: number[];
  ties: EuroTieSnap[];
}

/** True when a tie's tiebreak was a straight penalty shootout (0-0 plus penalties). */
export function isPenaltiesOnly(tiebreak: ScoreSnap): boolean {
  return tiebreak.h === 0 && tiebreak.a === 0 && tiebreak.ph !== undefined && tiebreak.pa !== undefined;
}
