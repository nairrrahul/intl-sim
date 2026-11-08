import { SEASON_START_YEAR } from "./config";
import { LAST_WINDOW_ID, getActiveWindow } from "./international/calendar/windows";
import { getWindowMatchdayCount } from "./international/lanes";
import { randInt } from "./shared/random";
import type { InternationalMatch } from "./international/types";
import { createWorld, playMatchday, playWindow } from "./world/lifecycle";
import type { Player } from "./players/types";
import type { World } from "./world/world";

/** What the UI holds: the world plus a counter bumped after every mutation. */
export interface Game {
  world: World;
  version: number;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  /** Optional link shown with the success toast. */
  link?: { to: string; label: string };
}

export function createGame(): Game {
  return { world: createWorld(), version: 0 };
}

export function getPlayer(game: Game, playerId: string): Player | null {
  return game.world.players.find(player => player.id === playerId) ?? null;
}

export function toggleShortlist(game: Game, playerId: string): ActionResult {
  const player = getPlayer(game, playerId);
  if (!player) return { ok: false, error: "Player not found." };
  player.isShortlisted = !player.isShortlisted;
  return { ok: true };
}

/** Assigns and stores stoppage-time display labels for goals when their match report is first opened. */
export function initializeGoalDisplayMinutes(game: Game, matches: InternationalMatch[]): ActionResult {
  for (const match of matches) {
    for (const goal of match.goals ?? []) {
      if (goal.displayMinute !== undefined || ![45, 90, 105, 120].includes(goal.minute)) continue;
      if (goal.minute < 91) {
        goal.displayMinute = `${goal.minute}+${randInt(1, 5)}`;
      } else {
        const stoppage = randInt(0, 2);
        goal.displayMinute = stoppage > 0 ? `${goal.minute}+${stoppage}` : String(goal.minute);
      }
    }
  }
  return { ok: true };
}

/** Plays the next matchday of the open window. */
export function simulateNextMatchday(game: Game): ActionResult {
  const outcome = playMatchday(game.world);
  if (!outcome) return { ok: false, error: "There is no open international window." };
  return { ok: true };
}

/** Plays the rest of the open window. */
export function simulateRestOfWindow(game: Game): ActionResult {
  return playWindow(game.world) ? { ok: true } : { ok: false, error: "There is no open international window." };
}

/** Plays `count` whole windows, starting with the open one. */
export function simulateWindows(game: Game, count: number): ActionResult {
  for (let played = 0; played < count; played++) {
    if (!playWindow(game.world)) return { ok: false, error: "There is no open international window." };
  }
  return { ok: true };
}

/** Plays windows until the current season's last window has been played. */
export function finishSeason(game: Game): ActionResult {
  const seasonYear = game.world.year;
  while (game.world.year === seasonYear) {
    if (!playWindow(game.world)) return { ok: false, error: "There is no open international window." };
  }
  return { ok: true };
}

export interface WindowProgress {
  windowId: string;
  label: string;
  matchdaysPlayed: number;
  matchdayCount: number;
  isLastWindowOfSeason: boolean;
}

/** Progress of the open window (null when none is open). */
export function getWindowProgress(world: World): WindowProgress | null {
  const window = getActiveWindow(world.international.windows);
  if (!window) return null;
  return {
    windowId: window.windowId,
    label: window.label,
    matchdaysPlayed: window.matchdaysPlayed,
    matchdayCount: getWindowMatchdayCount(window),
    isLastWindowOfSeason: window.windowId === LAST_WINDOW_ID
  };
}

export { SEASON_START_YEAR };
