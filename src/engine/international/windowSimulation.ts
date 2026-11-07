import { completeWindow } from "./windowCompletion";
import { getActiveWindow } from "./calendar/windows";
import { getWindowMatchdayCount } from "./lanes";
import { freezeCompletedEditions, isTrackedTournamentMatch } from "./editionInsights";
import { generateMatchDetails } from "./matchEvents";
import type { MatchSquad } from "./matchEvents";
import { isKnockoutMatch, isYouthMatch, playMatch } from "./matchResolution";
import { onRoundPlayed } from "./roundProgression";
import { STARTING_XI_SIZE } from "./squads";
import type { TrophyTeam } from "./roundProgression";
import { getPlayersById } from "../players/lookup";
import { getSeasonRow } from "../players/progression";
import type { World } from "../world/world";
import type { Player } from "../players/types";
import type { InternationalMatch, ScheduledRound, WindowRecord } from "./types";

type PlayersById = Map<string, Player>;

/** A nation's matchday squad for a window: the starting XI first, then the substitutes. */
function getMatchSquad(window: WindowRecord, code: string, playersById: PlayersById): MatchSquad {
  const players = (window.callUps[code] ?? []).flatMap(id => playersById.get(id) ?? []);
  return { starters: players.slice(0, STARTING_XI_SIZE), bench: players.slice(STARTING_XI_SIZE) };
}

/** A nation's U20 squad as it stands now: the starting XI, then the substitutes. */
function getU20MatchSquad(world: World, code: string, playersById: PlayersById): MatchSquad {
  const { u20 } = world.international.nations[code];
  const ids = [...u20.startingXI.filter((id): id is string => id !== null), ...u20.substitutes];
  const players = ids.flatMap(id => playersById.get(id) ?? []);
  return { starters: players.slice(0, STARTING_XI_SIZE), bench: players.slice(STARTING_XI_SIZE) };
}

/**
 * Records who played, scored, assisted and kept a clean sheet. Senior matches count towards the players'
 * season history; U20 matches only count as U20 appearances (they are not senior caps).
 */
function recordMatchDetails(match: InternationalMatch, window: WindowRecord, world: World, playersById: PlayersById): void {
  const youth = isYouthMatch(match);
  const details = generateMatchDetails(
    match.homeGoals ?? 0,
    match.awayGoals ?? 0,
    youth ? getU20MatchSquad(world, match.home, playersById) : getMatchSquad(window, match.home, playersById),
    youth ? getU20MatchSquad(world, match.away, playersById) : getMatchSquad(window, match.away, playersById),
    isKnockoutMatch(match)
  );
  match.goals = details.goals;
  match.substitutions = details.substitutions;

  // Tournament matches also keep who played and who kept clean sheets, for the competition stats tab.
  if (isTrackedTournamentMatch(match)) {
    match.appearances = {
      home: details.appearances.home.map(player => player.id),
      away: details.appearances.away.map(player => player.id)
    };
    match.cleanSheets = {};
    if (details.cleanSheets.home) match.cleanSheets.home = details.cleanSheets.home.id;
    if (details.cleanSheets.away) match.cleanSheets.away = details.cleanSheets.away.id;
  }

  if (youth) {
    for (const side of ["home", "away"] as const) {
      for (const player of details.appearances[side]) player.u20Caps += 1;
    }
    return;
  }

  const season = (player: Player) => getSeasonRow(player.progression, world.year);
  for (const side of ["home", "away"] as const) {
    for (const player of details.appearances[side]) {
      player.caps += 1;
      const row = season(player);
      if (row) row.caps += 1;
    }
    const goalkeeper = details.cleanSheets[side];
    const goalkeeperRow = goalkeeper && season(goalkeeper);
    if (goalkeeperRow) goalkeeperRow.cleanSheets += 1;
  }
  for (const goal of details.goals) {
    const scorerRow = season(playersById.get(goal.scorerId) as Player);
    if (scorerRow) scorerRow.goals += 1;
    const assister = goal.assistId ? playersById.get(goal.assistId) : undefined;
    const assisterRow = assister && season(assister);
    if (assisterRow) assisterRow.assists += 1;
  }
}

/** Gives every player in the winner's squad (senior matchday squad or U20 squad) the trophy on their current season's row. */
function awardTrophy(
  world: World, window: WindowRecord, playersById: PlayersById, code: string, trophy: string, team: TrophyTeam
): void {
  const ids = team === "u20"
    ? [...world.international.nations[code].u20.startingXI.filter((id): id is string => id !== null), ...world.international.nations[code].u20.substitutes]
    : window.callUps[code] ?? [];
  for (const id of ids) {
    const player = playersById.get(id);
    const row = player && getSeasonRow(player.progression, world.year);
    if (row) row.trophies.push(trophy);
  }
}

function playRound(world: World, window: WindowRecord, round: ScheduledRound, playersById: PlayersById): void {
  for (const match of round.matches) {
    playMatch(world.international, match);
    recordMatchDetails(match, window, world, playersById);
  }
  onRoundPlayed(world.international, window, round, (code, trophy, team) => awardTrophy(world, window, playersById, code, trophy, team));
  freezeCompletedEditions(world.international, playersById);
}

export interface MatchdayOutcome {
  window: WindowRecord;
  /** Matchday number that was just played (1-based). */
  matchday: number;
  /** True when that was the window's final matchday and the window has been closed. */
  windowCompleted: boolean;
}

/**
 * Plays the next matchday of the open window: the next round of every competition lane, side by
 * side. Knockout rounds drawn as a result join the following matchday. When no rounds remain the
 * window is completed.
 */
export function simulateMatchday(world: World): MatchdayOutcome | null {
  const window = getActiveWindow(world.international.windows);
  if (!window) return null;

  const matchday = window.matchdaysPlayed + 1;
  const playersById = getPlayersById(world.players);
  const roundsToPlay = window.rounds.filter(round => round.matchday === matchday);
  for (const round of roundsToPlay) playRound(world, window, round, playersById);
  window.matchdaysPlayed = matchday;

  const windowCompleted = matchday >= getWindowMatchdayCount(window);
  if (windowCompleted) completeWindow(world.international, window);
  return { window, matchday, windowCompleted };
}

/** Plays every remaining matchday of the open window. */
export function simulateRemainingWindow(world: World): WindowRecord | null {
  let outcome = simulateMatchday(world);
  if (!outcome) return null;
  while (!outcome.windowCompleted) {
    const next = simulateMatchday(world);
    if (!next) break;
    outcome = next;
  }
  return outcome.window;
}
