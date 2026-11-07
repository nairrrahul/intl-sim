import type { Player } from "./types";

let cache: { players: Player[]; size: number; index: Map<string, Player> } | null = null;

/**
 * Player lookup by ID. The index is rebuilt only when the player list changes (a new array, which pruning
 * produces, or added players), so callers can ask for it freely on every render or matchday.
 */
export function getPlayersById(players: Player[]): Map<string, Player> {
  if (!cache || cache.players !== players || cache.size !== players.length) {
    cache = { players, size: players.length, index: new Map(players.map(player => [player.id, player])) };
  }
  return cache.index;
}
