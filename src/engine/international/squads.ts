import { FORMATIONS, canPlayPosition, getFormationRequirements } from "../players/formations";
import { POSITION_GROUP } from "../players/positions";
import { RATING_MIN } from "../players/config";
import type { Player, Position } from "../players/types";
import type { World } from "../world/world";
import type { NationTeam, SquadState } from "./types";

export const SUBSTITUTE_COUNT = 7;
const STARTERS = 11;

/** U20 team members must be this age or younger. */
export const U20_MAX_AGE = 20;

// ---------------------------------------------------------------------------
// Starting XI selection
// ---------------------------------------------------------------------------

/** Slot indices ordered most-restrictive-position first. */
function getFillOrder(requirements: Position[]): number[] {
  const countOf = (position: Position) => requirements.filter(p => p === position).length;
  return requirements
    .map((_, index) => index)
    .sort((a, b) => countOf(requirements[a]) - countOf(requirements[b]));
}

/** Players best-first. The sort is stable, so equal overalls keep their original order. */
function rankByOverall(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall - a.overall);
}

/**
 * Best starting XI for a formation, aligned with getFormationRequirements(formation) (result[i] is the
 * player for slot i). Returns null when the squad cannot fill every position. `ranked` is the squad sorted
 * best-first (pass it when trying several formations to avoid re-sorting).
 */
export function selectBestStartingXI(players: Player[], formation: string, ranked = rankByOverall(players)): Player[] | null {
  const requirements = getFormationRequirements(formation);
  const used = new Set<Player>();
  const selected: Player[] = new Array(requirements.length);

  for (const slotIndex of getFillOrder(requirements)) {
    const required = requirements[slotIndex];
    const best = ranked.find(player => !used.has(player) && canPlayPosition(player.position, required));
    if (!best) return null;
    selected[slotIndex] = best;
    used.add(best);
  }
  return selected;
}

/**
 * Emergency XI for squads that cannot fill a formation properly: each slot takes the best player of its
 * position, else of its position group, else the best player left (goalkeepers only in goal where possible).
 */
function selectFallbackXI(players: Player[], formation: string): (Player | null)[] {
  const requirements = getFormationRequirements(formation);
  const unused = new Set(players);
  const selected: (Player | null)[] = new Array(requirements.length).fill(null);

  for (const slotIndex of getFillOrder(requirements)) {
    const required = requirements[slotIndex];
    const byOverall = [...unused].sort((a, b) => b.overall - a.overall);
    const pick =
      byOverall.find(player => canPlayPosition(player.position, required)) ??
      byOverall.find(player => POSITION_GROUP[player.position] === POSITION_GROUP[required]) ??
      byOverall.find(player => required === "GK" || player.position !== "GK") ??
      byOverall[0];
    if (!pick) continue;
    selected[slotIndex] = pick;
    unused.delete(pick);
  }
  return selected;
}

export function averageOverall(xi: (Player | null)[]): number {
  return Math.round(xi.reduce((sum, player) => sum + (player ? player.overall : RATING_MIN), 0) / STARTERS);
}

export interface FormationOption {
  formation: string;
  overall: number;
}

/** Every formation the squad can fill, best first. */
export function getViableFormations(players: Player[]): FormationOption[] {
  const options: FormationOption[] = [];
  const ranked = rankByOverall(players);
  for (const formation of Object.keys(FORMATIONS)) {
    const xi = selectBestStartingXI(players, formation, ranked);
    if (xi) options.push({ formation, overall: averageOverall(xi) });
  }
  return options.sort((a, b) => b.overall - a.overall);
}

/** Selects the bench by position-group quotas, then orders it by overall. */
export function selectSubstitutes(players: Player[], startingXI: (Player | null)[]): Player[] {
  const starters = new Set(startingXI);
  const remaining = players.filter(player => !starters.has(player)).sort((a, b) => b.overall - a.overall);
  const quotas = { GK: 1, DEF: 2, MID: 2, FWD: 2 } as const;
  const selected: Player[] = [];

  for (const [group, quota] of Object.entries(quotas) as [keyof typeof quotas, number][]) {
    selected.push(...remaining
      .filter(player => POSITION_GROUP[player.position] === group)
      .slice(0, quota));
  }
  return selected.sort((a, b) => b.overall - a.overall);
}

// ---------------------------------------------------------------------------
// Nation squads
// ---------------------------------------------------------------------------

export interface NationSquad {
  formation: string;
  startingXI: (Player | null)[];
  substitutes: Player[];
  overall: number;
  viableFormations: FormationOption[];
}

/**
 * Builds a nation's squad from its active players. The formation is `preferredFormation` when it is
 * viable, otherwise the viable formation with the highest XI overall.
 */
export function buildNationSquad(players: Player[], preferredFormation: string | null): NationSquad {
  const viableFormations = getViableFormations(players);
  const chosen = preferredFormation && viableFormations.some(option => option.formation === preferredFormation)
    ? preferredFormation
    : viableFormations[0]?.formation ?? "4-4-2";

  const startingXI: (Player | null)[] = selectBestStartingXI(players, chosen) ?? selectFallbackXI(players, chosen);
  return {
    formation: chosen,
    startingXI,
    substitutes: selectSubstitutes(players, startingXI),
    overall: averageOverall(startingXI),
    viableFormations
  };
}

function activePlayersOf(world: World, code: string): Player[] {
  return world.players.filter(player => !player.isRetired && player.primaryNationality === code);
}

/** A squad that has not been formed. */
export function createEmptySquadState(): SquadState {
  return { formed: false, formation: "4-4-2", formationLocked: false, startingXI: [], substitutes: [], overall: 0 };
}

/**
 * The U20 squad from the nation's players aged 20 or under who are not in the senior squad, using the same
 * formation selection as the senior team. It cannot be formed without a viable formation and a full bench.
 */
export function buildU20SquadState(candidates: Player[], previous: SquadState): SquadState {
  const viableFormations = getViableFormations(candidates);
  if (candidates.length < STARTERS + SUBSTITUTE_COUNT || viableFormations.length === 0) {
    return { ...createEmptySquadState(), formation: previous.formation };
  }
  const keepLocked = previous.formationLocked && viableFormations.some(option => option.formation === previous.formation);
  const formation = keepLocked ? previous.formation : viableFormations[0].formation;
  const startingXI = selectBestStartingXI(candidates, formation) as Player[];
  const substitutes = selectSubstitutes(candidates, startingXI);
  if (substitutes.length < SUBSTITUTE_COUNT) {
    return { ...createEmptySquadState(), formation: previous.formation };
  }
  return {
    formed: true,
    formation,
    formationLocked: keepLocked,
    startingXI: startingXI.map(player => player.id),
    substitutes: substitutes.map(player => player.id),
    overall: averageOverall(startingXI)
  };
}

/** Players available to a nation's U20 team: aged 20 or under and not in its senior XI or substitutes. */
export function getU20Candidates(players: Player[], nation: NationTeam): Player[] {
  const seniorIds = new Set([...nation.startingXI, ...nation.substitutes]);
  return players.filter(player => !player.isRetired && player.age <= U20_MAX_AGE && !seniorIds.has(player.id));
}

/** Recalculates one nation's senior and U20 formations, XIs, substitutes and overalls. */
export function refreshNationSquad(world: World, nation: NationTeam, players = activePlayersOf(world, nation.code)): NationSquad {
  const squad = buildNationSquad(players, nation.formationLocked ? nation.formation : null);
  if (nation.formationLocked && squad.formation !== nation.formation) nation.formationLocked = false;
  nation.formation = squad.formation;
  nation.startingXI = squad.startingXI.map(player => player?.id ?? null);
  nation.substitutes = squad.substitutes.map(player => player.id);
  nation.overall = squad.overall;

  // Players who are good enough for the senior squad are not available to the U20 team.
  nation.u20 = buildU20SquadState(getU20Candidates(players, nation), nation.u20);
  return squad;
}

/** Recalculates every nation's squad and overall. */
export function refreshAllNationSquads(world: World): void {
  const playersByNation = new Map<string, Player[]>();
  for (const player of world.players) {
    if (player.isRetired) continue;
    const list = playersByNation.get(player.primaryNationality) ?? [];
    list.push(player);
    playersByNation.set(player.primaryNationality, list);
  }
  for (const nation of Object.values(world.international.nations)) {
    refreshNationSquad(world, nation, playersByNation.get(nation.code) ?? []);
  }
}

/** Each nation's matchday squad for a window: the starting XI followed by the substitutes. */
export function getMatchdaySquads(nations: Record<string, NationTeam>): Record<string, string[]> {
  const squads: Record<string, string[]> = {};
  for (const nation of Object.values(nations)) {
    const ids = [...nation.startingXI.filter((id): id is string => id !== null), ...nation.substitutes];
    if (ids.length > 0) squads[nation.code] = ids;
  }
  return squads;
}

export const STARTING_XI_SIZE = STARTERS;
