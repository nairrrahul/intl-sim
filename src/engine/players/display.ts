import type { Player } from "./types";

/** The name a player is shown under: their common name, or first + last name. */
export function getPlayerName(player: Pick<Player, "firstName" | "lastName" | "commonName">): string {
  return player.commonName || `${player.firstName} ${player.lastName}`.trim();
}
