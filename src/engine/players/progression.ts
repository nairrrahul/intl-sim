import type { ProgressionEntry } from "./types";

/** A new season-history row: the player's ratings at the start of the season and empty stats. */
export function createSeasonRow(year: number, age: number, overall: number, potential: number): ProgressionEntry {
  return { year, age, overall, potential, caps: 0, goals: 0, assists: 0, cleanSheets: 0, trophies: [] };
}

/** The row for `seasonYear`, if the player has one (retired players stop getting new rows). */
export function getSeasonRow(progression: ProgressionEntry[], seasonYear: number): ProgressionEntry | null {
  const latest = progression[progression.length - 1];
  return latest && latest.year === seasonYear ? latest : null;
}
