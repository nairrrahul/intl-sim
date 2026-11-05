import { getConfederation } from "../../nations/nations";
import { pickRandom, shuffledCopy } from "../../shared/random";
import type { InternationalState } from "../types";
import { getCompetitivelyEligibleTeams } from "./eligibility";
import { createInternationalCupGroupMatches } from "./cupCommon";
import type { InternationalCompetitionEdition } from "./cupCommon";

/**
 * The U20 World Cup: 24 teams in six groups of four, then a round of 16 onwards with a third-place match.
 * There is no qualifying competition; each confederation sends its highest-rated U20 teams.
 */

/** First season (the January window, in the season's second calendar year) and the gap between editions. */
export const U20_WORLD_CUP_FIRST_SEASON = 2028;
export const U20_WORLD_CUP_INTERVAL = 2;
const U20_WORLD_CUP_WINDOW_ID = "IW4";

const GROUP_NAMES = ["A", "B", "C", "D", "E", "F"] as const;
const FIELD_SIZE = 24;
const MAX_DRAW_ATTEMPTS = 500;

/** Places per confederation. One extra place goes to a randomly chosen confederation from FLOATING_SLOT_CONFEDERATIONS. */
const CONFEDERATION_SLOTS: Record<string, number> = { AFC: 4, CAF: 4, CONCACAF: 4, CONMEBOL: 4, UEFA: 5, OFC: 2 };
const FLOATING_SLOT_CONFEDERATIONS = ["AFC", "CAF", "CONCACAF", "CONMEBOL"];

export type U20WorldCupEdition = InternationalCompetitionEdition;

export interface U20WorldCupState {
  editions: U20WorldCupEdition[];
}

export function createU20WorldCupState(): U20WorldCupState {
  return { editions: [] };
}

/** "U20" for the window the tournament is played in, otherwise null. */
export function getU20WorldCupWindowType(year: number, windowId: string): "U20" | null {
  const isEditionSeason = year >= U20_WORLD_CUP_FIRST_SEASON &&
    (year - U20_WORLD_CUP_FIRST_SEASON) % U20_WORLD_CUP_INTERVAL === 0;
  return isEditionSeason && windowId === U20_WORLD_CUP_WINDOW_ID ? "U20" : null;
}

export function findU20WorldCupEdition(state: U20WorldCupState, year: number, windowId: string): U20WorldCupEdition | null {
  return state.editions.find(edition => edition.year === year && edition.windowId === windowId) ?? null;
}

// ---------------------------------------------------------------------------
// Qualification: the best U20 teams of each confederation
// ---------------------------------------------------------------------------

/**
 * The 24 qualified nations, or null when too few nations can form a U20 team. Only nations whose U20 squad
 * has been formed can qualify; they are taken in order of U20 overall.
 */
export function selectU20WorldCupTeams(state: InternationalState, year: number): string[] | null {
  const eligible = new Set(getCompetitivelyEligibleTeams(Object.keys(state.nations), year));
  const ranked = Object.values(state.nations)
    .filter(nation => nation.u20.formed && eligible.has(nation.code))
    .sort((a, b) => b.u20.overall - a.u20.overall || b.overall - a.overall || a.code.localeCompare(b.code))
    .map(nation => nation.code);

  const field: string[] = [];
  const takeBest = (confederation: string, count: number) => {
    const candidates = ranked.filter(code => getConfederation(code) === confederation && !field.includes(code));
    field.push(...candidates.slice(0, count));
  };

  for (const [confederation, slots] of Object.entries(CONFEDERATION_SLOTS)) takeBest(confederation, slots);

  // The 24th place: the best remaining team of a randomly chosen AFC, CAF, CONCACAF or CONMEBOL.
  for (const confederation of shuffledCopy(FLOATING_SLOT_CONFEDERATIONS)) {
    if (field.length >= FIELD_SIZE) break;
    takeBest(confederation, 1);
  }

  // A confederation without enough formed teams hands its places to the best remaining teams anywhere.
  for (const code of ranked) {
    if (field.length >= FIELD_SIZE) break;
    if (!field.includes(code)) field.push(code);
  }
  return field.length === FIELD_SIZE ? field : null;
}

// ---------------------------------------------------------------------------
// Draw: pots by U20 rating, never two teams of one confederation in a group
// ---------------------------------------------------------------------------

/** Places every team of a pot in a different group, avoiding same-confederation clashes (random backtracking). */
function placePot(pot: string[], groups: string[][], availableGroups: number[]): boolean {
  const assigned = new Set<number>();
  const place = (index: number): boolean => {
    if (index === pot.length) return true;
    const team = pot[index];
    for (const groupIndex of shuffledCopy(availableGroups)) {
      if (assigned.has(groupIndex)) continue;
      if (groups[groupIndex].some(other => getConfederation(other) === getConfederation(team))) continue;
      groups[groupIndex].push(team);
      assigned.add(groupIndex);
      if (place(index + 1)) return true;
      groups[groupIndex].pop();
      assigned.delete(groupIndex);
    }
    return false;
  };
  return place(0);
}

/** The pots (host first in pot 1) and the six drawn groups. */
export function drawU20Groups(
  teams: string[],
  host: string,
  u20Overall: Record<string, number>
): { pots: string[][]; groups: string[][] } {
  const ranked = [...teams].sort((a, b) => (u20Overall[b] ?? 0) - (u20Overall[a] ?? 0) || a.localeCompare(b));
  const others = ranked.filter(code => code !== host);
  const potSize = teams.length / GROUP_NAMES.length;
  const pots = [[host, ...others.slice(0, GROUP_NAMES.length - 1)]];
  const remaining = others.slice(GROUP_NAMES.length - 1);
  for (let start = 0; start < remaining.length; start += GROUP_NAMES.length) {
    pots.push(remaining.slice(start, start + GROUP_NAMES.length));
  }
  if (pots.length !== potSize) throw new Error("The U20 World Cup draw needs four pots of six teams.");

  const allGroups = GROUP_NAMES.map((_, index) => index);
  for (let attempt = 0; attempt < MAX_DRAW_ATTEMPTS; attempt++) {
    const groups: string[][] = GROUP_NAMES.map(() => []);
    groups[0].push(host); // the host is the first seed of Group A
    const placedAll = pots.every((pot, potIndex) =>
      potIndex === 0
        ? placePot(pot.filter(code => code !== host), groups, allGroups.filter(index => index !== 0))
        : placePot(pot, groups, allGroups)
    );
    if (placedAll) return { pots, groups };
  }
  throw new Error("Could not draw U20 World Cup groups without two teams of one confederation in a group.");
}

/**
 * Draws the tournament played in (year, windowId): selects the field from the nations' current U20 teams,
 * picks a random host and draws the groups. Returns null when fewer than 24 nations can field a U20 team.
 */
export function createU20WorldCupEdition(
  state: InternationalState,
  year: number,
  windowId: string
): U20WorldCupEdition | null {
  const teams = selectU20WorldCupTeams(state, year);
  if (!teams) return null;

  const u20Overall = Object.fromEntries(teams.map(code => [code, state.nations[code].u20.overall]));
  const host = pickRandom(teams);
  const { pots, groups } = drawU20Groups(teams, host, u20Overall);

  const rankedByOverall = [...teams].sort((a, b) => u20Overall[b] - u20Overall[a] || a.localeCompare(b));
  const edition: U20WorldCupEdition = {
    id: `U20WC-${year}-${windowId}`,
    year,
    windowId,
    hosts: [host],
    teams,
    pots,
    // Group tie-breaks fall back to U20 rating rank (1 = strongest).
    seedRanks: Object.fromEntries(rankedByOverall.map((code, index) => [code, index + 1])),
    groups: groups.map((groupTeams, index) => ({
      name: GROUP_NAMES[index],
      teams: groupTeams,
      matches: createInternationalCupGroupMatches(groupTeams, GROUP_NAMES[index], year, windowId, "u20WorldCup")
    })),
    knockout: null,
    completed: false,
    winner: null,
    runnerUp: null,
    semifinalists: []
  };
  state.u20WorldCup.editions.push(edition);
  return edition;
}
