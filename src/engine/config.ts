/** First season of every new world (the 2026-27 season). */
export const SEASON_START_YEAR = 2026;

/** "2026-27" style label for the season starting in `year`. */
export function seasonDisplay(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}
