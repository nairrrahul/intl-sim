import { getConfederation } from "../../nations/nations";
import { shuffledCopy } from "../../shared/random";
import type { InternationalMatch, InternationalRound, InternationalState } from "../types";
import { createMatch } from "./cupCommon";
import { getCompetitivelyEligibleTeams } from "./eligibility";
import { getU20WorldCupWindowType } from "./u20WorldCup";
import { createGroupFixtures } from "./worldcup/utils";

/**
 * U20 World Cup qualifying, played in the September (IW1), October (IW2) and November (IW3) windows of the
 * season the tournament is played in. Entrants are each confederation's highest-rated U20 teams.
 *
 *   UEFA      15 teams, 5 groups of 3, home and away         -> 5 group winners
 *   CONCACAF  12 teams, 4 groups of 3, home and away         -> 4 group winners; best runner-up to the playoff
 *   AFC / CAF 16 teams, 4 groups of 4, single round-robin    -> 4 group winners; best runner-up to the playoff
 *   OFC       4 teams, two home-and-away series              -> 2 winners
 *   CONMEBOL  top 3 qualify; 4th v 5th home and away         -> winner qualifies, loser to the playoff
 *   Intercontinental playoff: the four playoff teams, semi-finals then a final -> 1 winner
 * That is 5 + 4 + 4 + 4 + 2 + 3 + 1 + 1 = 24 teams.
 */

export interface U20QualifyingGroup {
  name: string;
  teams: string[];
  /** Fixtures by round (index 0 = round 1). */
  matches: InternationalMatch[][];
}

export interface U20QualifyingTie {
  id: string;
  /** Hosts the first leg. */
  team1: string;
  team2: string;
  firstLeg: InternationalMatch;
  secondLeg: InternationalMatch;
  winner: string | null;
}

export interface U20QualifyingConfederation {
  confederation: string;
  /** Everyone who entered, best-rated first. */
  teams: string[];
  groups: U20QualifyingGroup[];
  ties: U20QualifyingTie[];
  /** CONMEBOL's top three, who skip the qualifiers. */
  autoQualified: string[];
  qualified: string[];
  /** The team sent to the intercontinental playoff, once known. */
  playoffTeam: string | null;
  completed: boolean;
  knockout: { label: string; matches: U20PlayoffMatch[] }[];
}

export interface U20PlayoffMatch {
  id: string;
  home: string;
  away: string;
  fixture: InternationalMatch;
  winner: string | null;
}

export interface U20QualifyingEdition {
  id: string;
  /** Season the U20 World Cup is played in. */
  year: number;
  confederations: Record<string, U20QualifyingConfederation>;
  /** Intercontinental playoff rounds: semi-finals, then the final. */
  playoff: { label: string; matches: U20PlayoffMatch[] }[] | null;
  /** The 24 qualified teams, complete once the playoff final has been played. */
  qualified: string[];
  completed: boolean;
}

export interface U20QualifyingState {
  editions: U20QualifyingEdition[];
}

export const createU20QualifyingState = (): U20QualifyingState => ({ editions: [] });

const PLAYOFF_CONFEDERATIONS = ["CONCACAF", "CONMEBOL", "AFC", "CAF"];

/** Group-stage confederations: how many teams, how many groups, and whether they play home and away. */
const GROUP_FORMATS: Record<string, { entrants: number; groups: number; homeAndAway: boolean; sendsRunnerUp: boolean }> = {
  UEFA: { entrants: 20, groups: 5, homeAndAway: true, sendsRunnerUp: false },
  CONCACAF: { entrants: 16, groups: 4, homeAndAway: true, sendsRunnerUp: true },
  AFC: { entrants: 16, groups: 4, homeAndAway: false, sendsRunnerUp: true },
  CAF: { entrants: 16, groups: 4, homeAndAway: false, sendsRunnerUp: true }
};
const OFC_ENTRANTS = 4;
const CONMEBOL_AUTO_QUALIFIERS = 3;
const CONMEBOL_ENTRANTS = 7;
const GROUP_NAMES = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** 0 = September (group matchdays, first half), 1 = October (second half, series), 2 = November (playoff). */
export type U20QualifyingPhase = 0 | 1 | 2;
const PHASE_WINDOWS = ["IW1", "IW2", "IW3"];

/** Which qualifying phase a window hosts, or null (qualifying runs in the three windows before the January finals). */
export function getU20QualifyingPhase(year: number, windowId: string): U20QualifyingPhase | null {
  const phase = PHASE_WINDOWS.indexOf(windowId);
  return phase >= 0 && getU20WorldCupWindowType(year, "IW4") === "U20" ? (phase as U20QualifyingPhase) : null;
}

export function findU20QualifyingEdition(state: U20QualifyingState, year: number): U20QualifyingEdition | null {
  return state.editions.find(edition => edition.year === year) ?? null;
}

/** The 24 qualified teams of a completed qualifying edition (null if qualifying did not run or is unfinished). */
export function getU20QualifiedTeams(state: InternationalState, year: number): string[] | null {
  const edition = findU20QualifyingEdition(state.u20Qualifying, year);
  return edition?.completed ? edition.qualified : null;
}

// ---------------------------------------------------------------------------
// Standings (points, then goals for, then goal difference, then alphabetical)
// ---------------------------------------------------------------------------

export interface U20QualifyingRow {
  code: string;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
}

const compareRows = (a: U20QualifyingRow, b: U20QualifyingRow): number =>
  b.points - a.points || b.goalsFor - a.goalsFor || b.goalDifference - a.goalDifference || a.code.localeCompare(b.code);

export function getU20QualifyingStandings(group: U20QualifyingGroup): U20QualifyingRow[] {
  const rows = new Map(group.teams.map((code): [string, U20QualifyingRow] => [code, {
    code, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
  }]));
  for (const match of group.matches.flat()) {
    if (match.homeGoals === null || match.awayGoals === null) continue;
    const home = rows.get(match.home) as U20QualifyingRow;
    const away = rows.get(match.away) as U20QualifyingRow;
    home.played++; away.played++;
    home.goalsFor += match.homeGoals; home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals; away.goalsAgainst += match.homeGoals;
    if (match.homeGoals > match.awayGoals) { home.won++; away.lost++; home.points += 3; }
    else if (match.homeGoals < match.awayGoals) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  return [...rows.values()]
    .map(row => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort(compareRows);
}

// ---------------------------------------------------------------------------
// Creating the edition
// ---------------------------------------------------------------------------

/** Every nation's U20 teams ranked best first: U20 overall, then senior overall, then code (as for the finals). */
function rankedFormedTeams(state: InternationalState, year: number): Record<string, string[]> {
  const eligible = new Set(getCompetitivelyEligibleTeams(Object.keys(state.nations), year));
  const byConfederation: Record<string, string[]> = {};
  Object.values(state.nations)
    .filter(nation => nation.u20.formed && eligible.has(nation.code))
    .sort((a, b) => b.u20.overall - a.u20.overall || b.overall - a.overall || Math.random() - 0.5 || a.code.localeCompare(b.code))
    .forEach(nation => (byConfederation[getConfederation(nation.code) ?? ""] ??= []).push(nation.code));
  return byConfederation;
}

type MatchFields = Partial<InternationalMatch>;

function qualifierMatch(home: string, away: string, year: number, windowId: string, fields: MatchFields): InternationalMatch {
  return createMatch(home, away, "u20Qualifier", year, windowId, fields);
}

/** Pots by rating (best `groups` teams in pot 1, and so on); each group takes one team from every pot. */
function drawGroups(teams: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (let start = 0; start < teams.length; start += groupCount) {
    shuffledCopy(teams.slice(start, start + groupCount)).forEach((team, index) => groups[index].push(team));
  }
  return groups;
}

/** Number of rounds played in the first (September) window; the rest are played in October. */
export const roundsInFirstWindow = (totalRounds: number): number => Math.ceil(totalRounds / 2);

function createGroupConfederation(
  confederation: string, teams: string[], year: number, editionId: string
): U20QualifyingConfederation {
  const format = GROUP_FORMATS[confederation];
  const groups = drawGroups(teams, format.groups).map((groupTeams, index): U20QualifyingGroup => {
    const rounds = createGroupFixtures(groupTeams, format.homeAndAway);
    const firstWindowRounds = roundsInFirstWindow(rounds.length);
    return {
      name: GROUP_NAMES[index],
      teams: groupTeams,
      matches: rounds.map((round, roundIndex) => round.map(fixture => qualifierMatch(
        fixture.home, fixture.away, year, roundIndex < firstWindowRounds ? "IW1" : "IW2", {
          u20QualifierEditionId: editionId, u20QualifierConfederation: confederation,
          u20QualifierStage: "group", u20QualifierGroup: GROUP_NAMES[index], u20QualifierRound: roundIndex + 1
        }
      )))
    };
  });
  return { confederation, teams, groups, ties: [], autoQualified: [], qualified: [], knockout: [], playoffTeam: null, completed: false };
}

/** A home-and-away series in the October window; `first` hosts the first leg. */
function createTie(
  confederation: string, id: string, first: string, second: string, year: number, editionId: string
): U20QualifyingTie {
  const fields = (leg: number): MatchFields => ({
    u20QualifierEditionId: editionId, u20QualifierConfederation: confederation,
    u20QualifierStage: "tie", u20QualifierTieId: id, u20QualifierLeg: leg
  });
  return {
    id, team1: first, team2: second, winner: null,
    firstLeg: qualifierMatch(first, second, year, "IW2", fields(1)),
    secondLeg: qualifierMatch(second, first, year, "IW2", fields(2))
  };
}

/**
 * Draws the qualifying for the U20 World Cup of season `year`. Returns null when a confederation cannot
 * field enough U20 teams (the finals then fall back to picking the best-rated teams directly).
 */
export function createU20QualifyingEdition(state: InternationalState, year: number): U20QualifyingEdition | null {
  const ranked = rankedFormedTeams(state, year);
  const needed: Record<string, number> = {
    ...Object.fromEntries(Object.entries(GROUP_FORMATS).map(([code, format]) => [code, format.entrants])),
    OFC: OFC_ENTRANTS, CONMEBOL: CONMEBOL_ENTRANTS
  };
  if (Object.entries(needed).some(([code, count]) => (ranked[code]?.length ?? 0) < count)) return null;

  const id = `U20Q-${year}`;
  const confederations: Record<string, U20QualifyingConfederation> = {};
  for (const code of Object.keys(GROUP_FORMATS)) {
    confederations[code] = createGroupConfederation(code, ranked[code].slice(0, needed[code]), year, id);
  }

  const ofc = ranked.OFC.slice(0, OFC_ENTRANTS);
  confederations.OFC = {
    confederation: "OFC", teams: ofc, groups: [], autoQualified: [], qualified: [], knockout: [], playoffTeam: null, completed: false,
    // 1 v 4 and 2 v 3: the lower seed hosts the first leg.
    ties: [createTie("OFC", "OFC-1", ofc[3], ofc[0], year, id), createTie("OFC", "OFC-2", ofc[2], ofc[1], year, id)]
  };

  const conmebol = ranked.CONMEBOL.slice(0, CONMEBOL_ENTRANTS);
  confederations.CONMEBOL = {
    confederation: "CONMEBOL",
    teams: conmebol,
    groups: [],
    ties: [],
    knockout: [{
      label: "Semi-finals",
      matches: [
        conmebolKnockoutMatch(id, year, conmebol[3], conmebol[6], "SF1"),
        conmebolKnockoutMatch(id, year, conmebol[4], conmebol[5], "SF2")
      ]
    }],
    completed: false,
    qualified: [...conmebol.slice(0, CONMEBOL_AUTO_QUALIFIERS)],
    autoQualified: conmebol.slice(0, CONMEBOL_AUTO_QUALIFIERS),
    playoffTeam: null
  };

  const edition: U20QualifyingEdition = { id, year, confederations, playoff: null, qualified: [], completed: false };
  state.u20Qualifying.editions.push(edition);
  return edition;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

const roundLabel = (confederation: string, detail: string): string => `U20 World Cup Qualifiers · ${confederation} · ${detail}`;

/** The rounds played in a window: group matchdays, series legs, or the intercontinental playoff semi-finals. */
export function getU20QualifyingRounds(edition: U20QualifyingEdition, phase: U20QualifyingPhase): InternationalRound[] {
  const rounds: InternationalRound[] = [];
  if (phase === 2) {
    const semiFinals = edition.playoff?.[0];
    if (semiFinals) rounds.push({ kind: "u20Qualifier", label: "U20 World Cup Qualifiers · Intercontinental Playoff · Semi-finals", leftOut: null, matches: semiFinals.matches.map(match => match.fixture) });
    return rounds;
  }
  for (const confederation of Object.values(edition.confederations)) {
    const total = Math.max(0, ...confederation.groups.map(group => group.matches.length));
    const firstWindowRounds = roundsInFirstWindow(total);
    const [from, to] = phase === 0 ? [0, firstWindowRounds] : [firstWindowRounds, total];
    for (let index = from; index < to; index++) {
      rounds.push({
        kind: "u20Qualifier", label: roundLabel(confederation.confederation, `Matchday ${index + 1}`), leftOut: null,
        matches: confederation.groups.flatMap(group => group.matches[index] ?? [])
      });
    }
    if (phase === 1 && confederation.ties.length > 0) {
      for (const leg of [1, 2] as const) {
        rounds.push({
          kind: "u20Qualifier", label: roundLabel(confederation.confederation, leg === 1 ? "First leg" : "Second leg"), leftOut: null,
          matches: confederation.ties.map(tie => (leg === 1 ? tie.firstLeg : tie.secondLeg))
        });
      }
    }
    if (phase === 1 && confederation.confederation === "CONMEBOL" && confederation.knockout) {
      for (const knockoutRound of confederation.knockout) {
        rounds.push({
          kind: "u20Qualifier",
          label: roundLabel("CONMEBOL", knockoutRound.label),
          leftOut: null,
          matches: knockoutRound.matches.map(match => match.fixture)
        });
      }
    }
  }
  return rounds;
}

// ---------------------------------------------------------------------------
// Progress: who qualified
// ---------------------------------------------------------------------------

const isPlayed = (match: InternationalMatch): boolean => match.homeGoals !== null && match.awayGoals !== null;

function settleConfederation(confederation: U20QualifyingConfederation): void {
  if (confederation.completed) return;
  if (!confederation.groups.every(group => group.matches.flat().every(isPlayed))) return;
  if (!confederation.ties.every(tie => tie.winner !== null)) return;

  const format = GROUP_FORMATS[confederation.confederation];
  if (format) {
    const tables = confederation.groups.map(getU20QualifyingStandings);
    confederation.qualified = tables.map(table => table[0].code);
    if (format.sendsRunnerUp) {
      confederation.playoffTeam = tables.map(table => table[1]).sort(compareRows)[0].code;
    }
  } else if (confederation.confederation === "CONMEBOL") {
    const final = confederation.knockout.find(round => round.label === "Final");

    if (!final || !final.matches[0]?.winner) return;

    const finalMatch = final.matches[0];
    const winner = finalMatch.winner;
    if (!winner) return;

    const runnerUp = winner === finalMatch.home
      ? finalMatch.away
      : finalMatch.home;

    confederation.qualified = [
      ...confederation.autoQualified,
      winner
    ];

    confederation.playoffTeam = runnerUp;
  } else if (confederation.confederation === "OFC") {
    confederation.qualified = confederation.ties.map(tie => tie.winner as string);
  } else {
    const [tie] = confederation.ties;
    confederation.qualified = [...confederation.autoQualified, tie.winner as string];
    confederation.playoffTeam = tie.winner === tie.team1 ? tie.team2 : tie.team1;
  }
  confederation.completed = true;
}

/** Re-checks every confederation after matches are played (call after each qualifying round). */
export function settleU20Qualifying(edition: U20QualifyingEdition): void {
  Object.values(edition.confederations).forEach(settleConfederation);
}

function conmebolKnockoutMatch(
  editionId: string,
  year: number,
  home: string,
  away: string,
  id: string
): U20PlayoffMatch {
  return {
    id,
    home,
    away,
    winner: null,
    fixture: qualifierMatch(home, away, year, "IW2", {
      u20QualifierEditionId: editionId,
      u20QualifierConfederation: "CONMEBOL",
      u20QualifierStage: "playoff",
      u20QualifierKnockoutMatchId: id
    })
  };
}

function playoffMatch(
  edition: U20QualifyingEdition, id: string, home: string, away: string, windowId: string
): U20PlayoffMatch {
  return {
    id, home, away, winner: null,
    fixture: qualifierMatch(home, away, edition.year, windowId, {
      u20QualifierEditionId: edition.id, u20QualifierConfederation: "ICPO",
      u20QualifierStage: "playoff", u20QualifierKnockoutMatchId: id
    })
  };
}

/** Once every confederation has finished, draws the playoff semi-finals (1 v 4 and 2 v 3 by U20 overall). */
export function createU20Playoff(state: InternationalState, edition: U20QualifyingEdition): boolean {
  if (edition.playoff) return true;
  if (!Object.values(edition.confederations).every(confederation => confederation.completed)) return false;
  const entrants = PLAYOFF_CONFEDERATIONS
    .map(code => edition.confederations[code].playoffTeam as string)
    .sort((a, b) => state.nations[b].u20.overall - state.nations[a].u20.overall || a.localeCompare(b));
  edition.playoff = [{
    label: "Semi-finals",
    matches: [
      playoffMatch(edition, "SF1", entrants[0], entrants[3], "IW3"),
      playoffMatch(edition, "SF2", entrants[1], entrants[2], "IW3")
    ]
  }];
  return true;
}

/**
 * Advances the playoff after a round: draws the final when both semi-finals are done, or completes
 * qualifying (24 teams) when the final has been played. Returns the final's round to add, if any.
 */
export function advanceU20Playoff(edition: U20QualifyingEdition, windowId: string): InternationalRound | null {
  const rounds = edition.playoff;
  const last = rounds?.[rounds.length - 1];
  if (!rounds || !last || last.matches.some(match => match.winner === null)) return null;

  if (last.label === "Semi-finals") {
    const [first, second] = last.matches.map(match => match.winner as string);
    const final = playoffMatch(edition, "F", first, second, windowId);
    rounds.push({ label: "Final", matches: [final] });
    return { kind: "u20Qualifier", label: "U20 World Cup Qualifiers · Intercontinental Playoff · Final", leftOut: null, matches: [final.fixture] };
  }
  edition.qualified = [
    ...Object.values(edition.confederations).flatMap(confederation => confederation.qualified),
    last.matches[0].winner as string
  ];
  edition.completed = true;
  return null;
}

export function advanceU20ConmebolKnockout(
  edition: U20QualifyingEdition
): InternationalRound | null {
  const rounds = edition.confederations.CONMEBOL.knockout;
  const last = rounds[rounds.length - 1];

  if (!last || last.matches.some(match => match.winner === null)) {
    return null;
  }

  if (last.label === "Semi-finals") {
    const [first, second] = last.matches.map(match => match.winner as string);

    const final = conmebolKnockoutMatch(
      edition.id,
      edition.year,
      first,
      second,
      "F"
    );

    rounds.push({
      label: "Final",
      matches: [final]
    });

    return {
      kind: "u20Qualifier",
      label: "U20 World Cup Qualifiers · CONMEBOL · Final",
      leftOut: null,
      matches: [final.fixture]
    };
  }

  return null;
}