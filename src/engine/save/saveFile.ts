import { seasonDisplay } from "../config";
import type { Game } from "../game";
import { createConfedCupState } from "../international/competitions/confedCup";
import { createU20WorldCupState } from "../international/competitions/u20WorldCup";
import { createEmptySquadState, refreshAllNationSquads } from "../international/squads";
import { initializeSavedTournamentInsights } from "../international/editionInsights";
import { getPlayersById } from "../players/lookup";
import { compareGraphs, deserializeGraph, serializeGraph } from "./graphSerializer";
import type { World } from "../world/world";

export const SAVE_FORMAT = "international-soccer-simulator-save";

/**
 * v1: the world (season year, international competitions, random players).
 * v2: players loaded from players.json, nation squads/formations, retirement, God Mode, rigged matches.
 *     (v2 saves made before goals/assists/trophies/Confederations Cup are upgraded when loaded.)
 */
export const SAVE_VERSION = 2;

export interface SaveMeta {
  season: string;
  year: number;
  /** The open window at the time of saving (null if none). */
  window: string | null;
  savedAt: string;
}

export interface SaveFile {
  format: string;
  version: number;
  meta: SaveMeta;
  root: unknown;
  nodes: unknown[];
}

interface WorldRoot {
  world: World;
}

function describeOpenWindow(world: World): string | null {
  const open = world.international.windows.find(window => window.status === "scheduled");
  return open ? `${open.windowId} ${open.year}` : null;
}

export function gameToSave(game: Game): SaveFile {
  const { root, nodes } = serializeGraph({ world: game.world } satisfies WorldRoot);
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    meta: {
      season: seasonDisplay(game.world.year),
      year: game.world.year,
      window: describeOpenWindow(game.world),
      savedAt: new Date().toISOString()
    },
    root,
    nodes
  };
}

/** Throws a user-readable Error if `value` is not a loadable save file. */
export function parseSaveFile(value: unknown): SaveFile {
  const file = value as Partial<SaveFile> | null;
  if (!file || typeof file !== "object" || file.format !== SAVE_FORMAT) {
    throw new Error("This file is not an International Soccer Simulator save.");
  }
  if (typeof file.version !== "number" || file.version > SAVE_VERSION) {
    throw new Error("This save was created by a newer version of the game and cannot be loaded.");
  }
  if (file.version < SAVE_VERSION) {
    throw new Error("This save was created by an older version of the game and cannot be loaded.");
  }
  if (!file.meta || !Array.isArray(file.nodes) || file.root === undefined) {
    throw new Error("The save file is incomplete or corrupted.");
  }
  return file as SaveFile;
}

export function parseSaveText(text: string): SaveFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON, so it cannot be a game save.");
  }
  return parseSaveFile(parsed);
}

function validateWorld(root: unknown): World {
  const world = (root as Partial<WorldRoot> | null)?.world;
  const international = world?.international;
  const valid =
    !!world && typeof world.year === "number" && typeof world.nextPlayerSeq === "number" &&
    typeof world.godMode === "boolean" &&
    Array.isArray(world.players) &&
    !!international && !!international.nations && Array.isArray(international.windows) &&
    Array.isArray(international.rankingHistory) && !!international.nationsLeague &&
    !!international.nationsLeague.divisions && !!international.nationsLeague.pots &&
    Array.isArray(international.nationsLeague.editions);
  if (!valid) throw new Error("The save file is corrupted: the game data is missing or inconsistent.");
  return world;
}

export function gameFromSave(file: SaveFile): Game {
  const world = validateWorld(deserializeGraph(file.root, file.nodes));
  // Saves made before per-season caps were tracked have no `caps` on their progression rows.
  world.international.confedCup ??= createConfedCupState();
  world.international.u20WorldCup ??= createU20WorldCupState();
  const missingU20 = Object.values(world.international.nations).some(nation => nation.u20 === undefined);
  for (const nation of Object.values(world.international.nations)) nation.u20 ??= createEmptySquadState();
  for (const player of world.players) player.u20Caps ??= 0;
  if (missingU20) refreshAllNationSquads(world);
  for (const player of world.players) {
    for (const season of player.progression) {
      season.caps ??= 0;
      season.goals ??= 0;
      season.assists ??= 0;
      season.cleanSheets ??= 0;
      season.trophies ??= [];
    }
  }
  initializeSavedTournamentInsights(world.international, getPlayersById(world.players));
  return { world, version: 0 };
}

/**
 * Proves a save is lossless: loads the file back through JSON and checks the result is identical
 * to the live game. Returns a description of the first difference, or null when the round trip is exact.
 */
export function verifySave(game: Game, file: SaveFile): string | null {
  try {
    const reloaded = gameFromSave(parseSaveText(JSON.stringify(file)));
    return compareGraphs({ world: game.world }, { world: reloaded.world });
  } catch (error) {
    return (error as Error).message;
  }
}

export function saveFileName(game: Game): string {
  const open = describeOpenWindow(game.world)?.split(" ")[0] ?? "done";
  return `international-save_${seasonDisplay(game.world.year)}_${open}.json`;
}
