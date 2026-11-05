import type { InternationalState } from "../international/types";
import type { Player } from "../players/types";

/** The whole simulated world: the current season year, national teams and competitions, and the player pool. */
export interface World {
  /** Start year of the current season (2026 = the 2026-27 season). */
  year: number;
  international: InternationalState;
  players: Player[];
  /** Counter used to allocate unique player IDs. */
  nextPlayerSeq: number;
  /** God Mode: unlocks editing (youth ratings, players, formations) and rigging matches. */
  godMode: boolean;
}
