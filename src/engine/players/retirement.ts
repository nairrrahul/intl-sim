import retirementChanceRaw from "./data/retirement_chance.json";
import type { World } from "../world/world";
import type { Player } from "./types";

const retirementChance = retirementChanceRaw as Record<string, number>;
const MINIMUM_RETIREMENT_AGE = 34;
const MAXIMUM_RETIREMENT_AGE = 41;
const LATE_BLOOMER_AGE_SHIFT = 2;
const BURNOUT_AGE_SHIFT = -2;

function getRetirementChance(player: Player): number {
  if (player.age < MINIMUM_RETIREMENT_AGE) return 0;
  if (player.age > MAXIMUM_RETIREMENT_AGE) return 0.95;

  const shift = player.playerType === "LATE BLOOMER"
    ? LATE_BLOOMER_AGE_SHIFT
    : player.playerType === "BURNOUT"
      ? BURNOUT_AGE_SHIFT
      : 0;
  const probabilityAge = player.age - shift;
  if (probabilityAge < MINIMUM_RETIREMENT_AGE) return 0;
  return retirementChance[String(Math.min(probabilityAge, MAXIMUM_RETIREMENT_AGE))] ?? 0;
}

/** Assigns each active player a once-per-season chance to retire at the end of this season. */
export function schedulePlayerRetirements(world: World): void {
  for (const player of world.players) {
    if (player.isRetired) continue;
    if (player.retirementYear === world.year) continue;

    player.retirementYear = null;
    const chance = getRetirementChance(player);
    if (chance > 0 && Math.random() < chance) {
      player.retirementYear = world.year;
    }
  }
}

/** Retires every player scheduled to retire this season. Returns the players who retired. */
export function retireScheduledPlayers(world: World): Player[] {
  const retiring = world.players.filter(player => !player.isRetired && player.retirementYear === world.year);
  for (const player of retiring) player.isRetired = true;
  return retiring;
}

/**
 * Removes retired players who never played for a national team, senior or U20 (and are not on the shortlist), from the world,
 * which keeps saves small. Returns how many were removed.
 */
export function pruneRetiredPlayers(world: World): number {
  const before = world.players.length;
  world.players = world.players.filter(player => !(player.isRetired && player.caps === 0 && player.u20Caps === 0 && !player.isShortlisted));
  return before - world.players.length;
}
