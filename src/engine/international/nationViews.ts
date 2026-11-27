import { formatWindowLabel, getActiveWindow, WINDOW_DEFS } from "./calendar/windows";
import {
  getDistributedInternationalRoundSchedule, getInternationalDisplayName, getInternationalWindowIndex,
  getInternationalWindowLocation, getInternationalWindowType,
  INTERNATIONAL_CYCLE_WINDOW_COUNT
} from "./calendar/windowCalendar";
import { getNationConfederation } from "./competitions/nationsLeague";
import { worldCupQualifyingCompetition } from "./competitions/worldcup/utils";
import { getWorldCupWindowType } from "./competitions/worldcup/worldCup";
import type { WorldCupEdition } from "./competitions/worldcup/types";
import { isYouthMatch } from "./matchResolution";
import type { MatchOutcome } from "./rankings";
import { getFinals, getPhaseDetails, getQualifying, getStage, windowOptions } from "./matchInfo";
import type { InternationalMatch, InternationalState, WindowRecord } from "./types";

export interface NationMatchRow {
  year: number;
  windowId: string;
  windowLabel: string;
  opponent: string;
  home: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  outcome: MatchOutcome | null;
  pointsChange: number | null;
  scheduled: boolean;
  kind: string;
  competitionLink?: string;
  stage?: string;
  penaltyShootout?: { goalsFor: number; goalsAgainst: number };
  /** The live fixture behind the row (opened for details when played, rigged in God Mode when not). */
  match?: InternationalMatch;
}

/**
 * Scheduled rows are built from copies of the fixtures (with their window filled in). This remembers
 * which live fixture each copy came from so the UI can act on the real match.
 */
const sourceFixtures = new WeakMap<InternationalMatch, InternationalMatch>();

function copyFixture(original: InternationalMatch, overrides: Partial<InternationalMatch>): InternationalMatch {
  const copy = { ...original, ...overrides };
  sourceFixtures.set(copy, sourceFixtures.get(original) ?? original);
  return copy;
}

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const KNOCKOUT_ROUND_NAMES: [string, string][] = [
  ["R32", "Round of 32"], ["R16", "Round of 16"], ["QF", "Quarter-Finals"], ["SF", "Semi-Finals"], ["Third Place", "Third Place"]
];
const SHORT_KNOCKOUT_ROUND_NAMES: [string, string][] = [["QF", "QF"], ["SF", "SF"], ["Third Place", "Third Place"]];

/** Round name from a knockout match ID such as "QF2" or "F". */
function knockoutRoundName(matchId: string | undefined, short = false): string {
  if (matchId === "F") return "Final";
  const names = short ? SHORT_KNOCKOUT_ROUND_NAMES : KNOCKOUT_ROUND_NAMES;
  return names.find(([prefix]) => matchId?.startsWith(prefix))?.[1] ?? "Knockout";
}

function worldCupPhaseLabel(phase?: string): string {
  return getInternationalDisplayName(phase ?? "").replace(/^World Cup /, "") || "Qualifying";
}

/** Cups with a group stage and knockout, keyed by match kind prefix: display name and field prefix. */
const CUPS = {
  goldCup: { name: "Gold Cup", groupName: "GS", shortKnockout: true },
  copaAmerica: { name: "Copa América", groupName: "GS", shortKnockout: true },
  confedCup: { name: "Confederations Cup", groupName: "Group Stage", shortKnockout: false },
  u20WorldCup: { name: "U20 World Cup", groupName: "Group Stage", shortKnockout: false },
  afcon: { name: "AFCON", groupName: "Group Stage", shortKnockout: false },
  afcCup: { name: "Asian Cup", groupName: "Group Stage", shortKnockout: false },
  ofcCup: { name: "OFC Cup", groupName: "Group Stage", shortKnockout: false },
  euro: { name: "EURO", groupName: "Group Stage", shortKnockout: false }
} as const;

type CupKey = keyof typeof CUPS;

/** Stage label of a finished match, e.g. "Gold Cup QF" or "AFCON Qualifying · Matchday 3". */
export function getMatchStage(match: InternationalMatch): string | undefined {
  return playedStage(match);
}

function playedStage(match: InternationalMatch): string | undefined {
  const kind = match.kind;
  const dash = "—";
  const details = getPhaseDetails(match);

  for (const key of Object.keys(CUPS) as CupKey[]) {
    const cup = CUPS[key];
    if (kind === `${key}Group`) {
      if (cup.groupName === "GS") return `${cup.name} GS`;
      if (key === "afcon") return `AFCON ${details.stage === "group" ? "Group Stage" : "Group"} · Matchday ${details.round ?? dash}`;
      return `${cup.name} Group Stage · Matchday ${details.round ?? dash}`;
    }
    if (kind === `${key}Knockout`) {
      return `${cup.name} ${knockoutRoundName(details.knockoutMatchId, cup.shortKnockout)}`;
    }
  }

  switch (kind) {
    case "goldCupPlayoff": return `Gold Cup Playoff · Leg ${details.leg ?? dash}`;
    case "afconQualifier":
      return details.stage === "preliminary"
        ? `AFCON Preliminary · Leg ${details.leg ?? dash}`
        : `AFCON Qualifying · Matchday ${details.round ?? dash}`;
    case "afcCupQualifier":
      return details.stage === "preliminary"
        ? `Asian Cup Preliminary · Leg ${details.leg ?? dash}`
        : `Asian Cup Qualifying · Matchday ${details.round ?? dash}`;
    case "ofcCupQualifier": return `OFC Cup Qualifying · Matchday ${details.round ?? dash}`;
    case "euroQualifier":
      return details.stage === "playoff"
        ? `EURO Play-off · Path ${details.path ?? dash} · ${details.pathRound === 1 ? "Semi-final" : "Final"}`
        : `EURO Qualifying · Matchday ${details.round ?? dash}`;
    case "worldCupQualifier": {
      const phase = worldCupPhaseLabel(details.stage);
      const detail = details.path
        ? ` · Path ${details.path} · Round ${details.pathRound ?? dash}`
        : details.tieId
          ? ` · Leg ${details.leg ?? dash}`
          : ` · Matchday ${details.round ?? dash}`;
      return `World Cup ${phase}${detail}`;
    }
    case "worldCupGroup": return `World Cup Group Stage · Matchday ${details.round ?? dash}`;
    case "worldCupKnockout": return `World Cup ${knockoutRoundName(details.knockoutMatchId)}`;
    case "u20Qualifier": return u20QualifierStage(match);
    default: return undefined;
  }
}

function u20QualifierStage(match: InternationalMatch): string {
  const details = getPhaseDetails(match);
  const where = details.confederation === "ICPO" ? "Intercontinental Playoff" : details.confederation;
  const detail = details.stage === "group" ? `Matchday ${details.round}`
    : details.stage === "tie" ? `Leg ${details.leg}`
    : knockoutRoundName(details.knockoutMatchId);
  return `U20 World Cup Qualifiers · ${where} · ${detail}`;
}

/** Stage label of a fixture that has not been played yet (shows raw knockout IDs). */
function scheduledStage(match: InternationalMatch): string | undefined {
  const kind = match.kind;
  const dash = "—";
  const details = getPhaseDetails(match);

  if (kind === "u20Qualifier") return u20QualifierStage(match);
  if (kind === "nationsLeague") return `${match.nationsLeagueInfo?.leagueDivision ?? "Nations League"} · Matchday ${match.nationsLeagueInfo?.leagueRound ?? dash}`;
  if (kind === "goldCupPlayoff") return `Gold Cup Playoff · Leg ${details.leg ?? dash}`;
  if (kind === "worldCupQualifier") {
    return `World Cup ${worldCupPhaseLabel(details.stage)} · Matchday ${details.round ?? details.leg ?? dash}`;
  }
  if (kind === "euroQualifier") return `EURO Qualifying · Matchday ${details.round ?? details.pathRound ?? dash}`;
  if (kind === "worldCupGroup") return `World Cup Group Stage · Matchday ${details.round ?? dash}`;
  if (kind === "worldCupKnockout") return `World Cup ${details.knockoutMatchId ?? "Knockout"}`;

  for (const key of Object.keys(CUPS) as CupKey[]) {
    const cup = CUPS[key];
    if (kind === `${key}Group`) return `${cup.name} Group Stage · Matchday ${details.round ?? dash}`;
    if (kind === `${key}Knockout`) return `${cup.name} ${details.knockoutMatchId ?? "Knockout"}`;
  }
  const qualifierNames: Record<string, string> = {
    afconQualifier: "AFCON", afcCupQualifier: "Asian Cup", ofcCupQualifier: "OFC Cup"
  };
  const qualifier = qualifierNames[kind];
  return qualifier ? `${qualifier} Qualifying · Matchday ${details.round ?? details.leg ?? dash}` : undefined;
}

/** Page of the competition a match belongs to. */
function competitionLink(match: InternationalMatch, nationCode: string): string | undefined {
  const kind = match.kind;
  const worldCupStage = getStage(match, "worldCup");
  return getLinkFromKind(kind, nationCode, worldCupStage, worldCupStage);
}

export function getLinkFromKind(competitionKind: string, nationCode: string, worldCupPhase?: string, worldCupStage?: string) : string {
  const links: Record<string, string> = {
    goldCupPlayoff: "/gold-cup-playoff",
    goldCupGroup: "/gold-cup", goldCupKnockout: "/gold-cup",
    copaAmericaGroup: "/copa-america", copaAmericaKnockout: "/copa-america",
    confedCupGroup: "/confederations-cup", confedCupKnockout: "/confederations-cup",
    u20WorldCupGroup: "/u20-world-cup", u20WorldCupKnockout: "/u20-world-cup",
    afconQualifier: "/afcon-qualifiers", afconGroup: "/afcon", afconKnockout: "/afcon",
    afcCupQualifier: "/afc-cup-qualifiers", afcCupGroup: "/afc-cup", afcCupKnockout: "/afc-cup",
    ofcCupQualifier: "/ofc-cup-qualifiers", ofcCupGroup: "/ofc-cup", ofcCupKnockout: "/ofc-cup",
    euroQualifier: "/euro-qualifiers", euroGroup: "/euro", euroKnockout: "/euro",
    worldCupGroup: "/world-cup", worldCupKnockout: "/world-cup"
  };
  if (competitionKind === "u20Qualifier") return "/u20-world-cup-qualifiers";
  if (competitionKind === "nationsLeague") return `/nations-league/${getNationConfederation(nationCode)}`;
  if (competitionKind === "worldCupQualifier") {
    return worldCupPhase === "ICPO" || worldCupStage === "ICPO"
      ? "/world-cup-intercontinental-playoff"
      : `/world-cup-qualifiers/${getNationConfederation(nationCode)}`;
  }
  return links[competitionKind];
}
// ---------------------------------------------------------------------------
// Played matches
// ---------------------------------------------------------------------------

const countScored = (kicks: string[]): number => kicks.filter(kick => kick === "O").length;

function playedRows(state: InternationalState, code: string, youth: boolean): NationMatchRow[] {
  const rows: NationMatchRow[] = [];
  for (const window of state.windows) {
    for (const round of window.rounds) {
      for (const match of round.matches) {
        if (match.home !== code && match.away !== code) continue;
        if (isYouthMatch(match) !== youth) continue;
        if (match.goalInfo === null) continue;

        const isHome = match.home === code;
        const goalsFor = isHome ? match.goalInfo.homeGoals : match.goalInfo.awayGoals;
        const goalsAgainst = isHome ? match.goalInfo.awayGoals : match.goalInfo.homeGoals;
        const shootoutFor = isHome ? match.homePenalties : match.awayPenalties;
        const shootoutAgainst = isHome ? match.awayPenalties : match.homePenalties;

        let outcome: MatchOutcome;
        if (shootoutFor && shootoutAgainst) outcome = countScored(shootoutFor) > countScored(shootoutAgainst) ? "win" : "loss";
        else outcome = goalsFor > goalsAgainst ? "win" : goalsFor < goalsAgainst ? "loss" : "draw";

        rows.push({
          year: window.year,
          windowId: window.windowId,
          windowLabel: formatWindowLabel(window.year, window.windowId),
          opponent: isHome ? match.away : match.home,
          home: isHome,
          goalsFor,
          goalsAgainst,
          outcome,
          // Youth matches do not move the world rankings.
          pointsChange: isYouthMatch(match) ? null : (isHome ? match.goalInfo.homeChange : match.goalInfo.awayChange),
          scheduled: false,
          kind: match.kind,
          stage: playedStage(match),
          penaltyShootout: shootoutFor && shootoutAgainst
            ? { goalsFor: countScored(shootoutFor), goalsAgainst: countScored(shootoutAgainst) }
            : undefined,
          competitionLink: competitionLink(match, code),
          match
        });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Scheduled fixtures
// ---------------------------------------------------------------------------

function isUnplayedMatch(value: unknown): value is InternationalMatch {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InternationalMatch>;
  return typeof candidate.home === "string" &&
    typeof candidate.away === "string" &&
    typeof candidate.kind === "string" &&
    candidate.goalInfo === null;
}

/**
 * Walks every competition's state and collects the unplayed fixtures it holds. Matches inherit the
 * year and window of the window record that contains them when they carry none themselves.
 */
function collectUnplayedMatches(state: InternationalState, version?: number): Map<string, InternationalMatch> {
  if (version !== undefined && unplayedCache?.state === state && unplayedCache.version === version) return unplayedCache.value;
  const value = findUnplayedMatches(state);
  if (version !== undefined) unplayedCache = { state, version, value };
  return value;
}

/** The last result, reused while the game has not changed (the walk below touches every competition). */
let unplayedCache: { state: InternationalState; version: number; value: Map<string, InternationalMatch> } | null = null;

function findUnplayedMatches(state: InternationalState): Map<string, InternationalMatch> {
  const roots: unknown[] = [
    state.windows, state.nationsLeague, state.goldCup, state.copaAmerica, state.confedCup, state.u20WorldCup, state.afcon, state.afcCup,
    state.ofcCup, state.euroQualifiers, state.euro, state.worldCup, state.u20Qualifying
  ];
  const seen = new WeakSet<object>();
  const candidates = new Map<string, InternationalMatch>();

  const visit = (value: unknown, parentWindow?: WindowRecord): void => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, parentWindow));
      return;
    }

    const record = value as Record<string, unknown>;
    // Finished things hold no unplayed fixtures, so skip them (this keeps the walk fast late in a long game).
    if (record.status === "played" || record.status === "complete") return;
    if (record.completed === true && "groups" in record && "knockout" in record) return;
    const windowContext = Array.isArray(record.rounds) && typeof record.year === "number" && typeof record.windowId === "string"
      ? value as WindowRecord
      : parentWindow;
    if (isUnplayedMatch(value)) {
      const match = copyFixture(value, {
        windowInfo: value.windowInfo ?? (windowContext ? windowOptions(windowContext.year, windowContext.windowId) : null)
      });
      const details = getPhaseDetails(match);
      // Two copies of a fixture are the same fixture when everything that identifies it (not its window) agrees.
      const identity = JSON.stringify([
        match.kind, match.home, match.away,
        [match.nationsLeagueInfo?.leagueId, match.nationsLeagueInfo?.leagueGroup, match.nationsLeagueInfo?.leagueRound],
        [details.ownerId, details.stage, details.phase, details.group, details.round, details.leg, details.tieId,
          details.knockoutMatchId, details.path, details.pathRound, details.pathMatch, details.matchIndex],
        match.kind === "friendly" ? [match.windowInfo?.windowYear, match.windowInfo?.windowId] : []
      ]);
      if (!candidates.has(identity)) candidates.set(identity, match);
    }
    Object.values(value).forEach(item => visit(item, windowContext));
  };
  roots.forEach(root => visit(root));
  return candidates;
}

/** EURO qualifying fixtures are drawn in advance but only assigned to windows by the schedule. */
function projectEuroQualifyingFixtures(
  candidates: InternationalMatch[],
  code: string,
  currentYear: number
): InternationalMatch[] {
  const fixtures = candidates.filter(match =>
    match.kind === "euroQualifier" && getQualifying(match, "euro")?.stage === "qualifying" &&
    (match.home === code || match.away === code) &&
    match.goalInfo === null &&
    match.windowInfo !== null
  );

  const byQualifier = new Map<string, InternationalMatch[]>();
  for (const match of fixtures) {
    const key = getQualifying(match, "euro")?.qualifierId ?? String(match.competitionInformation?.tournamentYear ?? match.windowInfo!.windowYear);
    byQualifier.set(key, [...(byQualifier.get(key) ?? []), match]);
  }

  const projected: InternationalMatch[] = [];
  for (const group of byQualifier.values()) {
    const anchorIndex = getInternationalWindowIndex(group[0].windowInfo!.windowYear, group[0].windowInfo!.windowId);
    const cycleStart = Math.floor(anchorIndex / INTERNATIONAL_CYCLE_WINDOW_COUNT) * INTERNATIONAL_CYCLE_WINDOW_COUNT;
    const slots = Array.from({ length: INTERNATIONAL_CYCLE_WINDOW_COUNT }, (_, offset) => cycleStart + offset)
      .map(getInternationalWindowLocation)
      .filter(location => getInternationalWindowType("UEFA", location.year, location.windowId) === "EUROQ");
    const totalRounds = Math.max(...group.map(match => getQualifying(match, "euro")?.round ?? 1));

    for (const match of group) {
      const roundIndex = (getQualifying(match, "euro")?.round ?? 1) - 1;
      const slot = slots.find(location => {
        const { start, count } = getDistributedInternationalRoundSchedule("UEFA", "EUROQ", location.year, location.windowId, totalRounds);
        return roundIndex >= start && roundIndex < start + count;
      });
      if (!slot || slot.year < currentYear) continue;
      projected.push(copyFixture(match, { windowInfo: windowOptions(slot.year, slot.windowId) }));
    }
  }
  return projected;
}

const WORLD_CUP_GROUP_PHASES: [string, keyof WorldCupEdition["regions"]][] = [
  ["SAWCQ", "CONMEBOL"], ["CAFWCQ", "CAF"],
  ["CCWCQ1", "CONCACAF"], ["CCWCQ2", "CONCACAF"], ["CCWCQ3", "CONCACAF"],
  ["AFCWCQ1", "AFC"], ["AFCWCQ2", "AFC"], ["AFCWCQ3", "AFC"],
  ["OFCWCQ1", "OFC"], ["OFCWCQ2", "OFC"], ["OFCWCQ3", "OFC"],
  ["UEFAWCQM", "UEFA"]
];

/** World Cup group fixtures and finals fixtures that have not been placed in a window yet. */
function projectWorldCupFixtures(state: InternationalState, code: string, currentYear: number): InternationalMatch[] {
  const projected: InternationalMatch[] = [];
  for (const edition of state.worldCup.editions) {
    const campaignEnd = getInternationalWindowIndex(edition.year, "IW6");
    const campaignStart = campaignEnd - INTERNATIONAL_CYCLE_WINDOW_COUNT + 1;

    for (const [phaseName, confederation] of WORLD_CUP_GROUP_PHASES) {
      const phase = edition.regions[confederation].phases[phaseName];
      if (!phase?.groups.length) continue;
      const totalRounds = Math.max(...phase.groups.map(group => group.matches.length));
      for (let index = campaignStart; index <= campaignEnd; index++) {
        const location = getInternationalWindowLocation(index);
        if (getWorldCupWindowType(confederation, location.year, location.windowId) !== phaseName) continue;
        const { start, count } = getDistributedInternationalRoundSchedule(confederation, phaseName, location.year, location.windowId, totalRounds);
        for (let roundIndex = start; roundIndex < start + count; roundIndex++) {
          for (const group of phase.groups) {
            for (const [matchIndex, fixture] of (group.matches[roundIndex] ?? []).entries()) {
              if (fixture.home !== code && fixture.away !== code) continue;
              if (fixture.goalInfo !== null) continue;
              if (fixture.windowInfo !== null) continue;
              if (location.year < currentYear) continue;
              projected.push(copyFixture(fixture, {
                kind: "worldCupQualifier",
                windowInfo: windowOptions(location.year, location.windowId),
                competitionInformation: worldCupQualifyingCompetition(edition.id, phaseName, {
                  round: roundIndex + 1,
                  group: group.name,
                  matchIndex
                })
              }));
            }
          }
        }
      }
    }

    if (!edition.tournament) continue;
    const tournamentWindow = WINDOW_DEFS.map(def => def.id).find(windowId =>
      WORLD_CUP_GROUP_PHASES.some(([, confederation]) => getWorldCupWindowType(confederation, edition.year, windowId) === "WC")
    );
    if (!tournamentWindow) throw new Error(`No World Cup window is configured for ${edition.year}.`);
    const tournamentMatches = [
      ...edition.tournament.groups.flatMap(group => group.matches.flat()),
      ...(edition.tournament.knockout?.flatMap(round => round.matches.map(match => match.fixture)) ?? [])
    ];
    for (const fixture of tournamentMatches) {
      if ((fixture.home !== code && fixture.away !== code) || fixture.goalInfo !== null) continue;
      if (fixture.windowInfo !== null) continue;
      projected.push(copyFixture(fixture, {
        kind: getFinals(fixture, "worldCup")?.knockoutMatchId ? "worldCupKnockout" : "worldCupGroup",
        windowInfo: windowOptions(edition.year, tournamentWindow)
      }));
    }
  }
  return projected;
}

function scheduledRows(state: InternationalState, code: string, currentYear: number, youth: boolean, version?: number): NationMatchRow[] {
  const candidates = collectUnplayedMatches(state, version);
  const ownCandidates = [...candidates.values()].filter(match => (match.home === code || match.away === code) && isYouthMatch(match) === youth);

  const scheduled: InternationalMatch[] = ownCandidates.filter(match =>
    !(match.kind === "euroQualifier" && getQualifying(match, "euro")?.stage === "qualifying") &&
    match.windowInfo !== null
  );
  scheduled.push(...projectEuroQualifyingFixtures(ownCandidates, code, currentYear));
  if (!youth) scheduled.push(...projectWorldCupFixtures(state, code, currentYear));

  const unique = new Map<string, InternationalMatch>();
  for (const match of scheduled) {
    const details = getPhaseDetails(match);
    const identity = JSON.stringify([
      match.kind, match.home, match.away, match.windowInfo?.windowYear, match.windowInfo?.windowId,
      details.ownerId, details.stage, details.round,
      match.nationsLeagueInfo?.leagueId, match.nationsLeagueInfo?.leagueRound
    ]);
    unique.set(identity, match);
  }

  const rows: NationMatchRow[] = [];
  for (const match of unique.values()) {
    if (match.home !== code && match.away !== code) continue;
    if (match.windowInfo === null || match.windowInfo.windowYear < currentYear) continue;
    const { windowYear, windowId } = match.windowInfo;
    const isHome = match.home === code;
    rows.push({
      year: windowYear,
      windowId,
      windowLabel: formatWindowLabel(windowYear, windowId),
      opponent: isHome ? match.away : match.home,
      home: isHome,
      goalsFor: null,
      goalsAgainst: null,
      outcome: null,
      pointsChange: null,
      scheduled: true,
      kind: match.kind,
      stage: scheduledStage(match),
      competitionLink: competitionLink(match, code),
      match: sourceFixtures.get(match) ?? match
    });
  }
  return rows;
}


/**
 * Played matches and scheduled fixtures for a nation's senior team (or, with `team: "u20"`, its U20 team),
 * oldest first. Pass the game's version to reuse the (expensive) search for scheduled fixtures between changes.
 */
export function getNationMatches(
  state: InternationalState,
  code: string,
  currentYear: number,
  options: { team?: "senior" | "u20"; version?: number } = {}
): NationMatchRow[] {
  const youth = options.team === "u20";
  const rows = [...playedRows(state, code, youth), ...scheduledRows(state, code, currentYear, youth, options.version)];
  rows.sort((a, b) =>
    a.year - b.year || a.windowId.localeCompare(b.windowId) || Number(a.scheduled) - Number(b.scheduled));
  return rows;
}

/** The nation a player is called up with for the open window, if any. */
export function getCallUpNation(state: InternationalState, playerID: string): string | null {
  const window = getActiveWindow(state.windows);
  if (!window) return null;
  for (const [code, ids] of Object.entries(window.callUps)) {
    if (ids.includes(playerID)) return code;
  }
  return null;
}
