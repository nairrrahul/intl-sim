/** Plain-data types for knockout brackets and round-robin schedules. */

export interface BracketSlot<T> {
  seed?: number;
  team: T | null;
}

export interface BracketMatch<T> {
  id: string;
  round: number;
  player1: BracketSlot<T> | null;
  player2: BracketSlot<T> | null;
  winner: T | null;
  sources: string[];
}

export interface Bracket<T> {
  size: number;
  activeRound: number;
  rounds: BracketMatch<T>[][];
}

export interface Fixture<T> {
  homeTeam: T;
  awayTeam: T;
}

/** Round-robin schedule keyed by 1-based round number. */
export type LeagueSchedule<T> = Record<number, Fixture<T>[]>;
