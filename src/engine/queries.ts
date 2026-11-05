import type { Game } from "./game";
import {
  computeOverallRankings, computeRankings
} from "./international/rankings";
import type { OverallRankRow, RankRow } from "./international/rankings";

/** World ranking by points and by current squad overall. */
export function getWorldRankings(game: Game): { points: RankRow[]; overall: OverallRankRow[] } {
  return {
    points: computeRankings(game.world.international),
    overall: computeOverallRankings(game.world.international)
  };
}
