import { getMatchdaySquads, refreshAllNationSquads } from "./squads";
import { FIRST_WINDOW_ID, formatWindowLabel, getFollowingWindow } from "./calendar/windows";
import { getInternationalWindowType, getNextCompetitionWindow } from "./calendar/windowCalendar";
import { isInternationalTeamCompetitivelyEligible } from "./competitions/eligibility";
import { createCupGroupRounds } from "./competitions/cupGroupRounds";
import {
  beginAfconQualifyingMainRounds, createAfconQualifierEdition, findAfconQualifierForWindow,
  getAFCONTournament, getAfconPreliminaryRounds, getAfconTournamentRounds, getAfconWindowType
} from "./competitions/afcon";
import {
  createAfcCupQualifierEdition, findAfcCupQualifier, getAfcCupMainRounds, getAfcCupPreliminaryRounds,
  getAfcCupTournament, getAfcCupTournamentRounds, getAfcCupWindowType
} from "./competitions/afcCup";
import {
  findOfcCupQualifier, getOfcCupQualifyingRounds, getOfcCupTournament, getOfcCupTournamentRounds,
  getOfcCupWindowType
} from "./competitions/ofcCup";
import {
  findEuroQualifyingEdition, getEuroPlayoffRounds, getEuroQualifyingRounds, getEuroWindowType
} from "./competitions/euroQualifiers";
import { getEuroTournament, getEuroTournamentRounds } from "./competitions/euros";
import {
  createGoldCupEdition, createGoldCupPlayoffEdition, findLatestGoldCupPlayoff, getGoldCupWindowType
} from "./competitions/goldCup";
import { createConfedCupEdition, findConfedCupEdition, getConfedCupWindowType } from "./competitions/confedCup";
import { createU20WorldCupEdition, findU20WorldCupEdition, getU20WorldCupWindowType } from "./competitions/u20WorldCup";
import { createCopaAmericaEdition } from "./competitions/copaAmerica";
import { getNationConfederation, getNationsLeagueRoundsForWindow, prepareNationsLeagueDraws } from "./competitions/nationsLeague";
import { addWorldCupRounds, WORLD_CUP_WINDOW_TYPES } from "./worldCupWindow";
import { FRIENDLY_SETS_PER_WINDOW, pairKey, scheduleFriendlies } from "./friendlies";
import { getLaneKey } from "./lanes";
import { getWorldRanks } from "./rankings";
import { getWorldCupWindowType } from "./competitions/worldcup/worldCup";
import type { World } from "../world/world";
import type { NationsLeagueEdition } from "./competitions/nationsLeague";
import type { InternationalRound, InternationalState, ScheduledRound, WindowRecord } from "./types";

/** Everything gathered while a window's fixtures are assembled. */
export interface WindowBuild {
  state: InternationalState;
  year: number;
  windowId: string;
  rounds: InternationalRound[];
  /** Nations that already play a competitive fixture in this window (and so get no friendly). */
  busy: Set<string>;
}

function latestCompletedConcacafNationsLeague(state: InternationalState): NationsLeagueEdition {
  const edition = [...state.nationsLeague.editions]
    .filter(candidate => candidate.confederation === "CONCACAF" && candidate.status === "complete")
    .sort((a, b) => b.startWindowIndex - a.startWindowIndex)[0];
  if (!edition) throw new Error("A completed CONCACAF Nations League edition is required for Gold Cup qualification.");
  return edition;
}

// ---------------------------------------------------------------------------
// Continental competitions
// ---------------------------------------------------------------------------

function addAfconRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  const type = getAfconWindowType(year, windowId);
  const suffix = type?.slice(-1) as "1" | "2" | undefined;
  if (!type || !suffix) return;

  if (type.startsWith("CAFQP")) {
    let qualifier = findAfconQualifierForWindow(state.afcon, year, suffix);
    if (!qualifier) {
      qualifier = createAfconQualifierEdition(state.afcon, year, suffix, windowId, getWorldRanks(state));
    }
    build.rounds.push(...getAfconPreliminaryRounds(qualifier));
    qualifier.preliminaryTeams.forEach(code => build.busy.add(code));
  } else if (type.startsWith("CAFQM")) {
    const qualifier = findAfconQualifierForWindow(state.afcon, year, suffix);
    if (!qualifier) throw new Error(`AFCON ${suffix} qualifying has not started.`);
    build.rounds.push(...beginAfconQualifyingMainRounds(qualifier, year, windowId));
    qualifier.mainGroups?.flatMap(group => group.teams).forEach(code => build.busy.add(code));
  } else if (type.startsWith("AFCON")) {
    const edition = getAFCONTournament(state.afcon, year, suffix);
    if (!edition) throw new Error(`AFCON ${suffix} edition has not been drawn.`);
    edition.teams.forEach(code => build.busy.add(code));
    build.rounds.push(...getAfconTournamentRounds(edition));
  }
}

function addAfcCupRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  const type = getAfcCupWindowType(year, windowId);

  if (type === "AFCQP") {
    const qualifier = findAfcCupQualifier(state.afcCup, year) ??
      createAfcCupQualifierEdition(state.afcCup, year, windowId, getWorldRanks(state));
    build.rounds.push(...getAfcCupPreliminaryRounds(qualifier));
    qualifier.preliminaryTeams.forEach(code => build.busy.add(code));
  } else if (type === "AFCQM") {
    const qualifier = findAfcCupQualifier(state.afcCup, year);
    if (!qualifier) throw new Error("Asian Cup qualifying has not started.");
    build.rounds.push(...getAfcCupMainRounds(qualifier, year, windowId));
    qualifier.mainGroups?.flatMap(group => group.teams).forEach(code => build.busy.add(code));
  } else if (type === "AFCCUP") {
    const edition = getAfcCupTournament(state.afcCup, year);
    if (!edition) throw new Error("Asian Cup edition has not been drawn.");
    edition.teams.forEach(code => build.busy.add(code));
    build.rounds.push(...getAfcCupTournamentRounds(edition));
  }
}

function addOfcCupRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  const type = getOfcCupWindowType(year, windowId);

  if (type === "OFCCUPQ") {
    const qualifier = findOfcCupQualifier(state.ofcCup, year);
    if (!qualifier) throw new Error(`OFC Cup qualifying for ${year} was not drawn in the preceding window.`);
    build.rounds.push(...getOfcCupQualifyingRounds(qualifier, year, windowId));
    qualifier.teams.forEach(code => build.busy.add(code));
  } else if (type === "OFCCUP") {
    const edition = getOfcCupTournament(state.ofcCup, year);
    if (!edition) throw new Error(`OFC Cup edition for ${year} has not been drawn.`);
    edition.teams.forEach(code => build.busy.add(code));
    build.rounds.push(...getOfcCupTournamentRounds(edition));
  }
}

function addEuroRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  const type = getEuroWindowType(year, windowId);

  if (type === "EUROQ") {
    const tournamentWindow = getNextCompetitionWindow(year, windowId, (y, id) => getEuroWindowType(y, id) === "EURO");
    const qualifier = findEuroQualifyingEdition(state.euroQualifiers, tournamentWindow.year);
    if (!qualifier) throw new Error(`EURO qualifying for ${tournamentWindow.year} was not drawn in the preceding window.`);
    build.rounds.push(...getEuroQualifyingRounds(qualifier, year, windowId));
    qualifier.groups.flatMap(group => group.teams).forEach(code => build.busy.add(code));
  } else if (type === "EUROQP") {
    const qualifier = state.euroQualifiers.editions.find(item =>
      item.tournamentYear === year && item.completed && !item.playoffComplete
    );
    if (!qualifier) throw new Error(`EURO qualifying play-offs for ${year} have not been drawn.`);
    build.rounds.push(...getEuroPlayoffRounds(qualifier, year, windowId));
    qualifier.playoffTeams.forEach(code => build.busy.add(code));
  } else if (type === "EURO") {
    const edition = getEuroTournament(state.euro, year);
    if (!edition) throw new Error(`EURO edition for ${year} has not been drawn.`);
    edition.teams.forEach(code => build.busy.add(code));
    build.rounds.push(...getEuroTournamentRounds(edition));
  }
}

function addCopaAmericaRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  if (getInternationalWindowType("CONMEBOL", year, windowId) !== "COPA") return;

  let edition = state.copaAmerica.editions.find(item => item.year === year && item.windowId === windowId);
  if (!edition) {
    edition = createCopaAmericaEdition(
      state.copaAmerica, state.goldCup, year, windowId, getWorldRanks(state)
    ).edition;
  }
  edition.teams.forEach(code => build.busy.add(code));
  build.rounds.push(...createCupGroupRounds(edition, "copaAmerica"));
}

function addConfedCupRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  if (getConfedCupWindowType(year, windowId) !== "CC") return;

  // The field is the latest continental and World Cup winners, so it is drawn as the window opens.
  const edition = findConfedCupEdition(state.confedCup, year, windowId) ??
    createConfedCupEdition(state, year, windowId, getWorldRanks(state));
  edition.teams.forEach(code => build.busy.add(code));
  build.rounds.push(...createCupGroupRounds(edition, "confedCup"));
}

/** The U20 World Cup is played by U20 squads, so it never keeps a nation's senior team from playing. */
function addU20WorldCupRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  if (getU20WorldCupWindowType(year, windowId) !== "U20") return;

  // Normally drawn after the previous window; drawn now if it was missed (e.g. a save from before it existed).
  const edition = findU20WorldCupEdition(state.u20WorldCup, year, windowId) ??
    createU20WorldCupEdition(state, year, windowId);
  if (edition) build.rounds.push(...createCupGroupRounds(edition, "u20WorldCup"));
}

// ---------------------------------------------------------------------------
// Friendlies, Nations League and the Gold Cup
// ---------------------------------------------------------------------------

/** Whether a nation has no competitive fixture of its own this window and may play friendlies. */
function isFriendlyCandidate(
  build: WindowBuild,
  code: string,
  goldCupPlayoffEntrants: string[] | null
): boolean {
  const { year, windowId } = build;
  const confederation = getNationConfederation(code);
  const worldCupType = getWorldCupWindowType(confederation, year, windowId);
  const hasOwnCompetition =
    (getAfconWindowType(year, windowId) !== null && confederation === "CAF") ||
    (getAfcCupWindowType(year, windowId) !== null && confederation === "AFC") ||
    (getOfcCupWindowType(year, windowId) !== null && confederation === "OFC") ||
    (getEuroWindowType(year, windowId) !== null && confederation === "UEFA") ||
    (worldCupType !== null && WORLD_CUP_WINDOW_TYPES.has(worldCupType)) ||
    (goldCupPlayoffEntrants !== null && confederation === "CONCACAF" && !goldCupPlayoffEntrants.includes(code));

  return (
    !isInternationalTeamCompetitivelyEligible(code, year) ||
    getInternationalWindowType(confederation, year, windowId) === "FR" ||
    hasOwnCompetition
  ) && !build.busy.has(code);
}

function addFriendlies(
  build: WindowBuild,
  overalls: Record<string, number>,
  goldCupPlayoffEntrants: string[] | null
): void {
  const candidates = Object.keys(build.state.nations)
    .filter(code => isFriendlyCandidate(build, code, goldCupPlayoffEntrants));
  if (candidates.length <= 1) return;

  const played = new Set<string>();
  for (let set = 0; set < FRIENDLY_SETS_PER_WINDOW; set++) {
    const round = scheduleFriendlies(build.state, overalls, played, candidates);
    round.label = `Friendlies · Set ${set + 1}`;
    round.matches.forEach(match => played.add(pairKey(match.home, match.away)));
    build.rounds.push(round);
  }
}

function addNationsLeagueRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  // Every confederation's matchday N is merged into one round per label.
  const roundsByLabel = new Map<string, InternationalRound>();
  for (const confederation of Object.keys(state.nationsLeague.divisions)) {
    const scheduled = getNationsLeagueRoundsForWindow(state.nationsLeague, confederation, year, windowId);
    if (!scheduled) continue;
    for (const item of scheduled.rounds) {
      const round = roundsByLabel.get(item.label) ?? {
        kind: "nationsLeague" as const,
        label: item.label,
        matches: [],
        leftOut: null
      };
      round.matches.push(...item.matches);
      roundsByLabel.set(item.label, round);
    }
  }
  build.rounds.push(...roundsByLabel.values());
}

function addGoldCupRounds(build: WindowBuild): void {
  const { state, year, windowId } = build;
  if (getGoldCupWindowType(year, windowId) !== "GC") return;

  let edition = state.goldCup.editions.find(item => item.year === year && item.windowId === windowId);
  if (!edition) {
    const playoff = findLatestGoldCupPlayoff(state.goldCup);
    if (!playoff) throw new Error("A completed Gold Cup playoff is required before the Gold Cup draw.");
    edition = createGoldCupEdition(
      state.goldCup, playoff.id, playoff.directQualifiers, year, windowId, getWorldRanks(state)
    ).edition;
  }
  build.rounds.push(...createCupGroupRounds(edition, "goldCup"));
}

// ---------------------------------------------------------------------------
// Window assembly
// ---------------------------------------------------------------------------

function assertCompetitiveEligibility(rounds: InternationalRound[], year: number): void {
  for (const round of rounds) {
    if (round.kind === "friendly") continue;
    for (const match of round.matches) {
      for (const code of [match.home, match.away]) {
        if (!isInternationalTeamCompetitivelyEligible(code, year)) {
          throw new Error(`${code} is banned from competitive international matches in the ${year}-${String(year + 1).slice(-2)} season.`);
        }
      }
    }
  }
}

/** Numbers rounds within their lanes (see lanes.ts) so they can be played matchday by matchday. */
function assignMatchdays(rounds: InternationalRound[]): ScheduledRound[] {
  const countByLane = new Map<string, number>();
  return rounds.map(round => {
    const lane = getLaneKey(round);
    const matchday = (countByLane.get(lane) ?? 0) + 1;
    countByLane.set(lane, matchday);
    return { ...round, lane, matchday };
  });
}

/** Whether the window about to open is the first one of the world (nothing has been opened yet). */
function nextWindowToOpen(world: World): { year: number; windowId: string } {
  const windows = world.international.windows;
  const last = windows[windows.length - 1];
  if (!last) return { year: world.year, windowId: FIRST_WINDOW_ID };
  const next = getFollowingWindow(last.year, last.windowId);
  return { year: next.year, windowId: next.def.id };
}

/**
 * Opens the next international window: players are called up, nations' overalls are updated and
 * the fixtures of every competition are drawn. Matches are played later, matchday by matchday.
 */
export function openNextWindow(world: World): WindowRecord {
  const state = world.international;
  const { year, windowId } = nextWindowToOpen(world);
  if (year !== world.year) throw new Error(`Window ${windowId} of ${year} cannot open in season ${world.year}.`);

  prepareNationsLeagueDraws(state.nationsLeague, year, windowId);
  refreshAllNationSquads(world);
  const callUps = getMatchdaySquads(state.nations);
  const overalls = Object.fromEntries(Object.values(state.nations).map(nation => [nation.code, nation.overall]));

  const build: WindowBuild = { state, year, windowId, rounds: [], busy: new Set() };

  let goldCupPlayoff: ReturnType<typeof createGoldCupPlayoffEdition> | null = null;
  if (getGoldCupWindowType(year, windowId) === "GCPO") {
    goldCupPlayoff = createGoldCupPlayoffEdition(
      latestCompletedConcacafNationsLeague(state), year, windowId, getWorldRanks(state)
    );
  }

  addAfconRounds(build);
  addAfcCupRounds(build);
  addOfcCupRounds(build);
  addEuroRounds(build);
  const worldCupFixtureTeams = addWorldCupRounds(build);
  addCopaAmericaRounds(build);
  addConfedCupRounds(build);
  addU20WorldCupRounds(build);
  assertCompetitiveEligibility(build.rounds, year);

  worldCupFixtureTeams.forEach(code => build.busy.add(code));
  addFriendlies(build, overalls, goldCupPlayoff ? goldCupPlayoff.edition.entrants : null);
  if (build.rounds.some(round => round.kind === "friendly" && round.matches.some(match =>
    worldCupFixtureTeams.has(match.home) || worldCupFixtureTeams.has(match.away)))) {
    throw new Error("A nation cannot be scheduled for both a World Cup qualifier and a friendly in the same window.");
  }

  addNationsLeagueRounds(build);
  if (goldCupPlayoff) {
    state.goldCup.playoffEditions.push(goldCupPlayoff.edition);
    build.rounds.push(...goldCupPlayoff.rounds);
  } else {
    addGoldCupRounds(build);
  }

  const record: WindowRecord = {
    year,
    windowId,
    label: formatWindowLabel(year, windowId),
    status: "scheduled",
    matchdaysPlayed: 0,
    rounds: assignMatchdays(build.rounds),
    callUps
  };
  state.windows.push(record);
  return record;
}
