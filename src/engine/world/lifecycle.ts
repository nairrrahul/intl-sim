import { SEASON_START_YEAR } from "../config";
import { LAST_WINDOW_ID } from "../international/calendar/windows";
import { createInternationalState } from "../international/state";
import { openNextWindow } from "../international/windowBuilder";
import { simulateMatchday } from "../international/windowSimulation";
import type { MatchdayOutcome } from "../international/windowSimulation";
import { DEVELOPMENT_FACILITY_RATING } from "../players/config";
import { formatPlayerId } from "../players/ids";
import { advancePlayerOneYear } from "../players/growth";
import { loadPlayersFromFile, nextSequenceAfter } from "../players/loader";
import { applyNewgenAdjustments, applyWonderkids, generateNationNewgens } from "../players/newgen";
import { pruneRetiredPlayers, retireScheduledPlayers, schedulePlayerRetirements } from "../players/retirement";
import type { World } from "./world";
import { Player } from "../players/types";

/** A new world: players loaded from players.json, retirements scheduled, and the first window open. */
export function createWorld(): World {
  const players = loadPlayersFromFile(SEASON_START_YEAR);
  const world: World = {
    year: SEASON_START_YEAR,
    international: createInternationalState(),
    players,
    nextPlayerSeq: nextSequenceAfter(players),
    godMode: false
  };
  schedulePlayerRetirements(world);
  openNextWindow(world);
  return world;
}

export function allocatePlayerId(world: World): string {
  return formatPlayerId(world.nextPlayerSeq++);
}

/**
 * Adds the new season's 11 fifteen-year-old newgens for every nation, based on its youth rating,
 * then picks a handful of the whole intake to be wonderkids.
 */
function youthTier(rating: number): "high" | "mid" | "low" {
  if (rating > 115) return "high";
  if (rating >= 60) return "mid";
  return "low";
}

function generateSeasonNewgens(world: World): void {
  const groups = { high: [], mid: [], low: [] } as Record<"high" | "mid" | "low", Player[]>;
  for (const nation of Object.values(world.international.nations)) {
    const newgens = generateNationNewgens(
      nation.code, nation.youthRating, world.year, () => allocatePlayerId(world)
    );
    groups[youthTier(nation.youthRating)].push(...newgens);
  }
  applyNewgenAdjustments({
    highPot: groups.high,
    midPot: groups.mid,
    lowPot: groups.low
  });
  const intake = [...groups.high, ...groups.mid, ...groups.low];
  
  applyWonderkids(intake);          // still picks from the whole intake
  world.players.push(...intake);
}

/**
 * Rolls the world into the next season: scheduled players retire (those who never won a cap are
 * pruned), everyone ages a year but only active players develop, new retirements are scheduled and
 * each nation receives its newgens.
 */
export function advanceYear(world: World): void {
  retireScheduledPlayers(world);
  pruneRetiredPlayers(world);
  world.year += 1;
  for (const player of world.players) {
    if (player.isRetired) player.age += 1; // retired players keep ageing, but their ratings and history are frozen
    else advancePlayerOneYear(player, world.year, DEVELOPMENT_FACILITY_RATING);
  }
  generateSeasonNewgens(world);
  schedulePlayerRetirements(world);
}

/**
 * Plays the next matchday of the open window. When that finishes the window, the season rolls over
 * (after the last window of the year) and the following window is opened so its draw can be inspected.
 */
export function playMatchday(world: World): MatchdayOutcome | null {
  const outcome = simulateMatchday(world);
  if (outcome?.windowCompleted) {
    if (outcome.window.windowId === LAST_WINDOW_ID) advanceYear(world);
    openNextWindow(world);
  }
  return outcome;
}

/** Plays every remaining matchday of the open window. Returns the window that was played. */
export function playWindow(world: World): MatchdayOutcome["window"] | null {
  let outcome = playMatchday(world);
  while (outcome && !outcome.windowCompleted) outcome = playMatchday(world);
  return outcome?.window ?? null;
}
