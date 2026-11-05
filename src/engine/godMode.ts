import type { ActionResult, Game } from "./game";
import { isValidNationCode } from "./nations/nations";
import { getU20Candidates, getViableFormations, refreshNationSquad } from "./international/squads";
import type { InternationalMatch } from "./international/types";
import { allocatePlayerId } from "./world/lifecycle";
import { MAX_PLAYER_RATING, MIN_PLAYER_RATING, PLAYER_AGE_MAX, PLAYER_AGE_MIN } from "./players/config";
import { POSITION_ORDER } from "./players/positions";
import { generateNameForNationalities } from "./players/names/nameGenerator";
import { getPlayerName } from "./players/display";
import { createSeasonRow, getSeasonRow } from "./players/progression";
import type { Player, Position } from "./players/types";

const fail = (error: string): ActionResult => ({ ok: false, error });

function requireGodMode(game: Game): ActionResult | null {
  return game.world.godMode ? null : fail("God Mode is not enabled.");
}

export function setGodMode(game: Game, enabled: boolean): ActionResult {
  game.world.godMode = enabled;
  return { ok: true };
}

export const YOUTH_RATING_MIN = 0;
export const YOUTH_RATING_MAX = 200;

/** Changes a nation's youth rating (affects the quality of its future newgen intakes). */
export function setNationYouthRating(game: Game, code: string, rating: number): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  const nation = game.world.international.nations[code];
  if (!nation) return fail("Unknown nation.");
  if (!Number.isFinite(rating) || rating < YOUTH_RATING_MIN || rating > YOUTH_RATING_MAX) {
    return fail(`Youth rating must be from ${YOUTH_RATING_MIN} to ${YOUTH_RATING_MAX}.`);
  }
  nation.youthRating = Math.round(rating);
  return { ok: true };
}

export interface AddPlayerInput {
  firstName?: string;
  lastName?: string;
  position: Position;
  age: number;
  overall: number;
  potential: number;
  primaryNationality: string;
  secondaryNationality: string | null;
}

/** Adds a custom player to the pool and refreshes the nation's squad. */
export function addPlayer(game: Game, input: AddPlayerInput): ActionResult & { playerID?: string } {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  if (!Number.isInteger(input.age) || input.age < PLAYER_AGE_MIN || input.age > PLAYER_AGE_MAX) {
    return fail(`Age must be an integer from ${PLAYER_AGE_MIN} to ${PLAYER_AGE_MAX}.`);
  }
  if (!POSITION_ORDER.includes(input.position)) return fail("Choose a valid player position.");
  for (const [label, value] of [["Overall", input.overall], ["Potential", input.potential]] as const) {
    if (!Number.isInteger(value) || value < MIN_PLAYER_RATING || value > MAX_PLAYER_RATING) {
      return fail(`${label} must be an integer from ${MIN_PLAYER_RATING} to ${MAX_PLAYER_RATING}.`);
    }
  }
  if (input.potential < input.overall) return fail("Potential must be greater than or equal to overall.");

  const primaryNationality = input.primaryNationality?.toUpperCase();
  if (!primaryNationality || !isValidNationCode(primaryNationality)) return fail("Choose a valid primary nationality.");
  const secondaryNationality = input.secondaryNationality?.toUpperCase() ?? null;
  if (secondaryNationality && !isValidNationCode(secondaryNationality)) return fail("Choose a valid secondary nationality.");
  if (secondaryNationality === primaryNationality) return fail("The second nationality must differ from the primary nationality.");

  const firstName = input.firstName?.trim() ?? "";
  const lastName = input.lastName?.trim() ?? "";
  const generated = !firstName || !lastName
    ? generateNameForNationalities(primaryNationality, secondaryNationality)
    : { firstName, lastName };

  const { world } = game;
  const player: Player = {
    id: allocatePlayerId(world),
    firstName: firstName || generated.firstName,
    lastName: lastName || generated.lastName,
    commonName: null,
    primaryNationality,
    secondaryNationality,
    age: input.age,
    overall: input.overall,
    potential: input.potential,
    position: input.position,
    playerType: null,
    peakRange: null,
    progression: [createSeasonRow(world.year, input.age, input.overall, input.potential)],
    caps: 0,
    u20Caps: 0,
    isShortlisted: false,
    retirementYear: null,
    isRetired: false
  };
  world.players.push(player);
  refreshNationSquad(world, world.international.nations[primaryNationality]);
  return {
    ok: true,
    message: `Added ${player.firstName} ${player.lastName}.`,
    link: { to: `/player/${player.id}`, label: "View Player" },
    playerID: player.id
  };
}

export type SquadTeam = "senior" | "u20";

/** Formations a nation's senior or U20 squad can currently field, best first. */
export function getEligibleFormations(game: Game, code: string, team: SquadTeam = "senior") {
  const nation = game.world.international.nations[code];
  const players = game.world.players.filter(player => !player.isRetired && player.primaryNationality === code);
  return getViableFormations(team === "senior" ? players : getU20Candidates(players, nation));
}

/** Forces a nation's senior or U20 team to use a formation (it must be one the squad can fill). */
export function setNationFormation(game: Game, code: string, formation: string, team: SquadTeam = "senior"): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  const nation = game.world.international.nations[code];
  if (!nation) return fail("Unknown nation.");
  if (!getEligibleFormations(game, code, team).some(option => option.formation === formation)) {
    return fail(`${code} cannot field a ${formation}.`);
  }
  const squad = team === "senior" ? nation : nation.u20;
  squad.formation = formation;
  squad.formationLocked = true;
  refreshNationSquad(game.world, nation);
  return { ok: true };
}

/** Returns a nation's senior or U20 team to automatically using its best formation. */
export function resetNationFormation(game: Game, code: string, team: SquadTeam = "senior"): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  const nation = game.world.international.nations[code];
  if (!nation) return fail("Unknown nation.");
  (team === "senior" ? nation : nation.u20).formationLocked = false;
  refreshNationSquad(game.world, nation);
  return { ok: true };
}

/**
 * Sets a player's current overall and potential. Their growth continues from the new values, and their
 * nation's squads are rebuilt (so they may move in or out of the senior or U20 team).
 */
export function setPlayerRatings(game: Game, playerId: string, overall: number, potential: number): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  const player = game.world.players.find(candidate => candidate.id === playerId);
  if (!player) return fail("Player not found.");
  for (const [label, value] of [["Overall", overall], ["Potential", potential]] as const) {
    if (!Number.isInteger(value) || value < MIN_PLAYER_RATING || value > MAX_PLAYER_RATING) {
      return fail(`${label} must be an integer from ${MIN_PLAYER_RATING} to ${MAX_PLAYER_RATING}.`);
    }
  }
  if (potential < overall) return fail("Potential must be greater than or equal to overall.");

  player.overall = overall;
  player.potential = potential;
  const season = getSeasonRow(player.progression, game.world.year);
  if (season) {
    season.overall = overall;
    season.potential = potential;
  }
  const nation = game.world.international.nations[player.primaryNationality];
  if (nation && !player.isRetired) refreshNationSquad(game.world, nation);
  return { ok: true, message: `Updated ${getPlayerName(player)}.` };
}

export function isMatchPlayed(match: InternationalMatch): boolean {
  return match.homeGoals !== null && match.awayGoals !== null;
}

/** Forces the result of an unplayed match (a drawn knockout match goes to a randomized shootout). */
export function rigMatch(game: Game, match: InternationalMatch, homeGoals: number, awayGoals: number): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  if (isMatchPlayed(match)) return fail("This match has already been played.");
  for (const goals of [homeGoals, awayGoals]) {
    if (!Number.isInteger(goals) || goals < 0 || goals > 99) return fail("Goals must be whole numbers from 0 to 99.");
  }
  match.rigged = { homeGoals, awayGoals };
  return { ok: true };
}

export function clearRiggedMatch(game: Game, match: InternationalMatch): ActionResult {
  const blocked = requireGodMode(game);
  if (blocked) return blocked;
  delete match.rigged;
  return { ok: true };
}
