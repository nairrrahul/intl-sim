import type { InternationalRound, InternationalState } from "../types";
import { getCompetitivelyEligibleTeams } from "./eligibility";
import {
  THIRD_PLACE_MATCH_ID, createInternationalCupGroupMatches, drawInternationalCupGroups,
  getInternationalCupStandings, getKnockoutLosers, makeKnockoutMatch
} from "./cupCommon";
import type { InternationalCompetitionEdition } from "./cupCommon";

/** The Confederations Cup: 8 teams, two groups of four, semi-finals, a final and a third-place match. */

/** First season it is played (the September window), and the gap between editions in seasons. */
export const CONFED_CUP_FIRST_SEASON = 2030;
export const CONFED_CUP_INTERVAL = 4;
const CONFED_CUP_WINDOW_ID = "IW1";
const GROUP_NAMES = ["A", "B"] as const;
const FIELD_SIZE = 8;

export type ConfedCupEdition = InternationalCompetitionEdition;

export interface ConfedCupState {
  editions: ConfedCupEdition[];
}

export function createConfedCupState(): ConfedCupState {
  return { editions: [] };
}

/** "CC" for the window the Confederations Cup is played in, otherwise null. */
export function getConfedCupWindowType(year: number, windowId: string): "CC" | null {
  const isEditionSeason = year >= CONFED_CUP_FIRST_SEASON && (year - CONFED_CUP_FIRST_SEASON) % CONFED_CUP_INTERVAL === 0;
  return isEditionSeason && windowId === CONFED_CUP_WINDOW_ID ? "CC" : null;
}

interface FinishedTournament {
  year: number;
  completed: boolean;
  winner: string | null;
}

function latestWinner(tournaments: FinishedTournament[]): string | null {
  return [...tournaments]
    .filter(tournament => tournament.completed && tournament.winner)
    .sort((a, b) => b.year - a.year)[0]?.winner ?? null;
}

/** The most recent World Cup winner, if there has been one. */
function latestWorldCupWinner(state: InternationalState): string | null {
  return latestWinner(state.worldCup.editions.flatMap(edition => edition.tournament ? [edition.tournament] : []));
}

/**
 * The eight teams: the latest winner of the World Cup, AFCON, Asian Cup, EURO, OFC Cup, Copa América and
 * Gold Cup, plus the top-ranked team. Duplicates (and missing winners) are replaced by the best-ranked
 * eligible teams not yet in the field, whatever their confederation.
 */
export function selectConfedCupTeams(
  state: InternationalState,
  year: number,
  worldRanks: Record<string, number>
): string[] {
  const rankOf = (code: string) => worldRanks[code] ?? Number.MAX_SAFE_INTEGER;
  const eligible = new Set(getCompetitivelyEligibleTeams(Object.keys(state.nations), year));
  const byRank = [...eligible].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b));

  const entitled = [
    latestWorldCupWinner(state),
    latestWinner(state.afcon.editions),
    latestWinner(state.afcCup.editions),
    latestWinner(state.euro.editions),
    latestWinner(state.ofcCup.editions),
    latestWinner(state.copaAmerica.editions),
    latestWinner(state.goldCup.editions),
    byRank[0] ?? null
  ];
  const field: string[] = [];
  for (const code of entitled) {
    if (code && eligible.has(code) && !field.includes(code)) field.push(code);
  }
  for (const code of byRank) {
    if (field.length >= FIELD_SIZE) break;
    if (!field.includes(code)) field.push(code);
  }
  return field;
}

export function findConfedCupEdition(state: ConfedCupState, year: number, windowId: string): ConfedCupEdition | null {
  return state.editions.find(edition => edition.year === year && edition.windowId === windowId) ?? null;
}

/** Draws a Confederations Cup: the World Cup winner hosts, and the pots are seeded by world ranking. */
export function createConfedCupEdition(
  state: InternationalState,
  year: number,
  windowId: string,
  worldRanks: Record<string, number>
): ConfedCupEdition {
  const teams = selectConfedCupTeams(state, year, worldRanks);
  if (teams.length !== FIELD_SIZE) throw new Error(`The Confederations Cup needs ${FIELD_SIZE} teams, but only ${teams.length} are eligible.`);

  const worldCupWinner = latestWorldCupWinner(state);
  const host = worldCupWinner && teams.includes(worldCupWinner) ? worldCupWinner : teams[0];
  const { pots, groups } = drawInternationalCupGroups(teams, [host], worldRanks, [...GROUP_NAMES]);

  const id = `CC-${year}-${windowId}`;
  const edition: ConfedCupEdition = {
    id,
    year,
    windowId,
    hosts: [host],
    teams,
    pots,
    seedRanks: Object.fromEntries(teams.map(code => [code, worldRanks[code] ?? Number.MAX_SAFE_INTEGER])),
    groups: groups.map((groupTeams, index) => ({
      name: GROUP_NAMES[index],
      teams: groupTeams,
      matches: createInternationalCupGroupMatches(groupTeams, GROUP_NAMES[index], year, windowId, "confedCup")
    })),
    knockout: null,
    completed: false,
    winner: null,
    runnerUp: null,
    semifinalists: []
  };
  state.confedCup.editions.push(edition);
  return edition;
}

function roundOf(label: string, matches: ReturnType<typeof makeKnockoutMatch>[]): InternationalRound {
  return {
    kind: "confedCup",
    label: `Confederations Cup · ${label}`,
    leftOut: null,
    matches: matches.map(match => match.fixture)
  };
}

/**
 * Advances the knockout: `roundIndex` is -1 once the groups are finished (draws the semi-finals:
 * 1A v 2B and 1B v 2A), 0 after the semi-finals (final + third place), 1 after the final (completes).
 */
export function advanceConfedCupRound(edition: ConfedCupEdition, roundIndex: number): InternationalRound | null {
  if (roundIndex === -1) {
    if (edition.groups.some(group => group.matches.flat().some(match => match.homeGoals === null || match.awayGoals === null))) {
      return null;
    }
    const placed = Object.fromEntries(edition.groups.map(group => [
      group.name,
      getInternationalCupStandings(edition, group).slice(0, 2).map(row => row.code)
    ])) as Record<"A" | "B", string[]>;
    const semiFinals = [
      makeKnockoutMatch(edition, "SF1", placed.A[0], placed.B[1], "confedCup"),
      makeKnockoutMatch(edition, "SF2", placed.B[0], placed.A[1], "confedCup")
    ];
    edition.knockout = [{ label: "Semi-finals", matches: semiFinals }];
    return roundOf("Semi-finals", semiFinals);
  }

  const round = edition.knockout?.[roundIndex];
  if (!round || round.matches.some(match => match.winner === null)) return null;

  if (roundIndex === 0) {
    const [first, second] = round.matches.map(match => match.winner as string);
    const [firstLoser, secondLoser] = getKnockoutLosers(round.matches);
    edition.semifinalists = round.matches.flatMap(match => [match.home, match.away]);
    const finals = [
      makeKnockoutMatch(edition, "F", first, second, "confedCup"),
      makeKnockoutMatch(edition, THIRD_PLACE_MATCH_ID, firstLoser, secondLoser, "confedCup")
    ];
    edition.knockout?.push({ label: "Final", matches: finals });
    return roundOf("Final", finals);
  }

  const final = round.matches[0];
  edition.winner = final.winner;
  edition.runnerUp = final.winner === final.home ? final.away : final.home;
  edition.thirdPlace = round.matches.find(match => match.id === THIRD_PLACE_MATCH_ID)?.winner ?? null;
  edition.completed = true;
  return null;
}
