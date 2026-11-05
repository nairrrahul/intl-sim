import windowsRaw from "../data/international_windows.json";
import { SEASON_START_YEAR } from "../../config";
import type { WindowRecord } from "../types";

export interface WindowDef {
  id: string;
  label: string;
}

export const WINDOW_DEFS: WindowDef[] = (windowsRaw as { windows: WindowDef[] }).windows;

/** Windows of a season split evenly across its two calendar years (IW1-3 in the first, IW4-6 in the second). */
export function getWindowCalendarYear(seasonYear: number, windowId: string): number {
  const index = WINDOW_DEFS.findIndex(def => def.id === windowId);
  return index < WINDOW_DEFS.length / 2 ? seasonYear : seasonYear + 1;
}

/** e.g. "September Window 2026" (IW1 of the 2026-27 season) or "January Window 2027" (its IW4). */
export function formatWindowLabel(seasonYear: number, windowId: string): string {
  const def = WINDOW_DEFS.find(candidate => candidate.id === windowId);
  return `${def?.label ?? windowId} ${getWindowCalendarYear(seasonYear, windowId)}`;
}

export const FIRST_WINDOW_ID = WINDOW_DEFS[0].id;
export const LAST_WINDOW_ID = WINDOW_DEFS[WINDOW_DEFS.length - 1].id;

export interface LocatedWindow {
  year: number;
  def: WindowDef;
  /** How many windows after the starting point this one is (1 = the very next window). */
  offset: number;
}

/** Finds the first window after (year, windowId) that satisfies `matches`, searching four years ahead. */
export function findUpcomingWindow(
  year: number,
  windowId: string,
  matches: (year: number, def: WindowDef) => boolean
): LocatedWindow | null {
  const currentIndex = WINDOW_DEFS.findIndex(def => def.id === windowId);
  if (currentIndex === -1) throw new Error(`Unknown international window ID "${windowId}".`);

  for (let offset = 1; offset <= WINDOW_DEFS.length * 4; offset++) {
    const absoluteIndex = (year - SEASON_START_YEAR) * WINDOW_DEFS.length + currentIndex + offset;
    const candidateYear = SEASON_START_YEAR + Math.floor(absoluteIndex / WINDOW_DEFS.length);
    const candidateDef = WINDOW_DEFS[absoluteIndex % WINDOW_DEFS.length];
    if (matches(candidateYear, candidateDef)) return { year: candidateYear, def: candidateDef, offset };
  }
  return null;
}

/** The window that follows (year, windowId) in the calendar. */
export function getFollowingWindow(year: number, windowId: string): { year: number; def: WindowDef } {
  const index = WINDOW_DEFS.findIndex(def => def.id === windowId);
  if (index === -1) throw new Error(`Unknown international window ID "${windowId}".`);
  return index === WINDOW_DEFS.length - 1
    ? { year: year + 1, def: WINDOW_DEFS[0] }
    : { year, def: WINDOW_DEFS[index + 1] };
}

export function getActiveWindow(windows: WindowRecord[]): WindowRecord | null {
  return windows.find(window => window.status === "scheduled") ?? null;
}
