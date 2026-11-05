import { formatWindowLabel, getActiveWindow, WINDOW_DEFS } from "./calendar/windows";
import {
  getDistributedInternationalRoundSchedule, getInternationalDisplayName, getInternationalWindowIndex,
  getInternationalWindowLocation, getInternationalWindowType,
  INTERNATIONAL_CYCLE_WINDOW_COUNT
} from "./calendar/windowCalendar";
import { getNationConfederation } from "./competitions/nationsLeague";
import { getWorldCupWindowType } from "./competitions/worldcup/worldCup";
import type { WorldCupEdition } from "./competitions/worldcup/types";
import { isYouthMatch } from "./matchResolution";
import type { MatchOutcome } from "./rankings";
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

type Fields = Record<string, string | number | undefined>;

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
  ["R32", "Round of 32"], ["R16", "Round of 16"], ["QF", "Quarter-finals"], ["SF", "Semi-finals"], ["3P", "Third place"]
];
const SHORT_KNOCKOUT_ROUND_NAMES: [string, string][] = [["QF", "QF"], ["SF", "SF"], ["3P", "Third place"]];

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
  const f = match as unknown as Fields;
  const kind = match.kind;
  const dash = "—";

  for (const key of Object.keys(CUPS) as CupKey[]) {
    const cup = CUPS[key];
    if (kind === `${key}Group`) {
      if (cup.groupName === "GS") return `${cup.name} GS`;
      if (key === "afcon") return `AFCON ${match.afconStage === "group" ? "Group Stage" : "Group"} · Matchday ${match.afconRound ?? dash}`;
      return `${cup.name} Group Stage · Matchday ${f[`${key}Round`] ?? dash}`;
    }
    if (kind === `${key}Knockout`) {
      return `${cup.name} ${knockoutRoundName(f[`${key}KnockoutMatchId`] as string | undefined, cup.shortKnockout)}`;
    }
  }

  switch (kind) {
    case "goldCupPlayoff": return `Gold Cup Playoff · Leg ${match.goldCupLeg ?? dash}`;
    case "afconQualifier":
      return match.afconStage === "preliminary"
        ? `AFCON Preliminary · Leg ${match.afconLeg ?? dash}`
        : `AFCON Qualifying · Matchday ${match.afconRound ?? dash}`;
    case "afcCupQualifier":
      return match.afcCupStage === "preliminary"
        ? `Asian Cup Preliminary · Leg ${match.afcCupLeg ?? dash}`
        : `Asian Cup Qualifying · Matchday ${match.afcCupRound ?? dash}`;
    case "ofcCupQualifier": return `OFC Cup Qualifying · Matchday ${match.ofcCupRound ?? dash}`;
    case "euroQualifier":
      return match.euroStage === "playoff"
        ? `EURO Play-off · Path ${match.euroPath ?? dash} · ${match.euroPathRound === 1 ? "Semi-final" : "Final"}`
        : `EURO Qualifying · Matchday ${match.euroRound ?? dash}`;
    case "worldCupQualifier": {
      const phase = worldCupPhaseLabel(match.worldCupPhase ?? match.worldCupStage);
      const detail = match.worldCupPath
        ? ` · Path ${match.worldCupPath} · Round ${match.worldCupPathRound ?? dash}`
        : match.worldCupTieId
          ? ` · Leg ${match.worldCupLeg ?? dash}`
          : ` · Matchday ${match.worldCupRound ?? dash}`;
      return `World Cup ${phase}${detail}`;
    }
    case "worldCupGroup": return `World Cup Group Stage · Matchday ${match.worldCupRound ?? dash}`;
    case "worldCupKnockout": return `World Cup ${knockoutRoundName(match.worldCupKnockoutMatchId)}`;
    default: return undefined;
  }
}

/** Stage label of a fixture that has not been played yet (shows raw knockout IDs). */
function scheduledStage(match: InternationalMatch): string | undefined {
  const f = match as unknown as Fields;
  const kind = match.kind;
  const dash = "—";

  if (kind === "nationsLeague") return `${match.nationsLeagueDivision ?? "Nations League"} · Matchday ${match.nationsLeagueRound ?? dash}`;
  if (kind === "goldCupPlayoff") return `Gold Cup Playoff · Leg ${match.goldCupLeg ?? dash}`;
  if (kind === "worldCupQualifier") {
    return `World Cup ${worldCupPhaseLabel(match.worldCupPhase ?? match.worldCupStage)} · Matchday ${match.worldCupRound ?? match.worldCupLeg ?? dash}`;
  }
  if (kind === "euroQualifier") return `EURO Qualifying · Matchday ${match.euroRound ?? match.euroPathRound ?? dash}`;
  if (kind === "worldCupGroup") return `World Cup Group Stage · Matchday ${match.worldCupRound ?? dash}`;
  if (kind === "worldCupKnockout") return `World Cup ${match.worldCupKnockoutMatchId ?? "Knockout"}`;

  for (const key of Object.keys(CUPS) as CupKey[]) {
    const cup = CUPS[key];
    if (kind === `${key}Group`) return `${cup.name} Group Stage · Matchday ${f[`${key}Round`] ?? dash}`;
    if (kind === `${key}Knockout`) return `${cup.name} ${f[`${key}KnockoutMatchId`] ?? "Knockout"}`;
  }
  const qualifierNames: Record<string, [string, string, string]> = {
    afconQualifier: ["AFCON", "afconRound", "afconLeg"],
    afcCupQualifier: ["Asian Cup", "afcCupRound", "afcCupLeg"],
    ofcCupQualifier: ["OFC Cup", "ofcCupRound", "ofcCupRound"]
  };
  const qualifier = qualifierNames[kind];
  return qualifier ? `${qualifier[0]} Qualifying · Matchday ${f[qualifier[1]] ?? f[qualifier[2]] ?? dash}` : undefined;
}

/** Page of the competition a match belongs to. */
function competitionLink(match: InternationalMatch, nationCode: string): string | undefined {
  const kind = match.kind;
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
  if (kind === "nationsLeague") return `/nations-league/${getNationConfederation(nationCode)}`;
  if (kind === "worldCupQualifier") {
    return match.worldCupPhase === "ICPO" || match.worldCupStage === "ICPO"
      ? "/world-cup-intercontinental-playoff"
      : `/world-cup-qualifiers/${getNationConfederation(nationCode)}`;
  }
  return links[kind];
}

// ---------------------------------------------------------------------------
// Played matches
// ---------------------------------------------------------------------------

const countScored = (kicks: string[]): number => kicks.filter(kick => kick === "O").length;

function playedRows(state: InternationalState, code: string): NationMatchRow[] {
  const rows: NationMatchRow[] = [];
  for (const window of state.windows) {
    for (const round of window.rounds) {
      for (const match of round.matches) {
        if (match.home !== code && match.away !== code) continue;
        if (match.homeGoals === null || match.awayGoals === null) continue;

        const isHome = match.home === code;
        const goalsFor = isHome ? match.homeGoals : match.awayGoals;
        const goalsAgainst = isHome ? match.awayGoals : match.homeGoals;
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
          pointsChange: isYouthMatch(match) ? null : (isHome ? match.homeChange : match.awayChange) ?? 0,
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
    (candidate.homeGoals === null || typeof candidate.homeGoals === "number") &&
    (candidate.awayGoals === null || typeof candidate.awayGoals === "number") &&
    (candidate.homeGoals === null || candidate.awayGoals === null) &&
    (candidate.homeChange === null || typeof candidate.homeChange === "number") &&
    (candidate.awayChange === null || typeof candidate.awayChange === "number");
}

/**
 * Walks every competition's state and collects the unplayed fixtures it holds. Matches inherit the
 * year and window of the window record that contains them when they carry none themselves.
 */
function collectUnplayedMatches(state: InternationalState): Map<string, InternationalMatch> {
  const roots: unknown[] = [
    state.windows, state.nationsLeague, state.goldCup, state.copaAmerica, state.confedCup, state.u20WorldCup, state.afcon, state.afcCup,
    state.ofcCup, state.euroQualifiers, state.euro, state.worldCup
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
    const windowContext = Array.isArray(record.rounds) && typeof record.year === "number" && typeof record.windowId === "string"
      ? value as WindowRecord
      : parentWindow;
    if (isUnplayedMatch(value)) {
      const match = copyFixture(value, {
        windowYear: value.windowYear ?? windowContext?.year,
        windowId: value.windowId ?? windowContext?.windowId
      });
      const identity = JSON.stringify([
        match.kind, match.home, match.away,
        Object.entries(match)
          .filter(([key]) => !["windowYear", "windowId"].includes(key) &&
            /(?:Id|Stage|Phase|Round|Leg|Group|Path|MatchIndex|Match)$/.test(key))
          .sort(([a], [b]) => a.localeCompare(b)),
        match.kind === "friendly" ? [match.windowYear, match.windowId] : []
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
    match.kind === "euroQualifier" && match.euroStage === "qualifying" &&
    (match.home === code || match.away === code) &&
    (match.homeGoals === null || match.awayGoals === null) &&
    match.windowYear !== undefined && match.windowId
  );

  const byQualifier = new Map<string, InternationalMatch[]>();
  for (const match of fixtures) {
    const key = match.euroQualifierId ?? String(match.euroTournamentYear ?? match.windowYear);
    byQualifier.set(key, [...(byQualifier.get(key) ?? []), match]);
  }

  const projected: InternationalMatch[] = [];
  for (const group of byQualifier.values()) {
    const anchorIndex = getInternationalWindowIndex(group[0].windowYear!, group[0].windowId!);
    const cycleStart = Math.floor(anchorIndex / INTERNATIONAL_CYCLE_WINDOW_COUNT) * INTERNATIONAL_CYCLE_WINDOW_COUNT;
    const slots = Array.from({ length: INTERNATIONAL_CYCLE_WINDOW_COUNT }, (_, offset) => cycleStart + offset)
      .map(getInternationalWindowLocation)
      .filter(location => getInternationalWindowType("UEFA", location.year, location.windowId) === "EUROQ");
    const totalRounds = Math.max(...group.map(match => match.euroRound ?? 1));

    for (const match of group) {
      const roundIndex = (match.euroRound ?? 1) - 1;
      const slot = slots.find(location => {
        const { start, count } = getDistributedInternationalRoundSchedule("UEFA", "EUROQ", location.year, location.windowId, totalRounds);
        return roundIndex >= start && roundIndex < start + count;
      });
      if (!slot || slot.year < currentYear) continue;
      projected.push(copyFixture(match, { windowYear: slot.year, windowId: slot.windowId }));
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
              if (fixture.homeGoals !== null || fixture.awayGoals !== null) continue;
              if (fixture.windowYear !== undefined && fixture.windowId) continue;
              if (location.year < currentYear) continue;
              projected.push(copyFixture(fixture, {
                kind: "worldCupQualifier",
                windowYear: location.year,
                windowId: location.windowId,
                worldCupEditionId: edition.id,
                worldCupStage: phaseName,
                worldCupPhase: phaseName,
                worldCupRound: roundIndex + 1,
                worldCupGroup: group.name,
                worldCupMatchIndex: matchIndex
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
      if ((fixture.home !== code && fixture.away !== code) || (fixture.homeGoals !== null && fixture.awayGoals !== null)) continue;
      if (fixture.windowYear !== undefined && fixture.windowId) continue;
      projected.push(copyFixture(fixture, {
        kind: fixture.worldCupKnockoutMatchId ? "worldCupKnockout" : "worldCupGroup",
        windowYear: edition.year,
        windowId: tournamentWindow,
        worldCupEditionId: edition.id
      }));
    }
  }
  return projected;
}

function scheduledRows(state: InternationalState, code: string, currentYear: number): NationMatchRow[] {
  const candidates = collectUnplayedMatches(state);
  const ownCandidates = [...candidates.values()].filter(match => match.home === code || match.away === code);

  const scheduled: InternationalMatch[] = ownCandidates.filter(match =>
    !(match.kind === "euroQualifier" && match.euroStage === "qualifying") &&
    match.windowYear !== undefined && match.windowId
  );
  scheduled.push(...projectEuroQualifyingFixtures(ownCandidates, code, currentYear));
  scheduled.push(...projectWorldCupFixtures(state, code, currentYear));

  const unique = new Map<string, InternationalMatch>();
  for (const match of scheduled) {
    const identity = JSON.stringify([
      match.kind, match.home, match.away, match.windowYear, match.windowId,
      match.worldCupEditionId, match.worldCupPhase, match.worldCupRound,
      match.euroQualifierId, match.euroStage, match.euroRound,
      match.nationsLeagueId, match.nationsLeagueRound,
      match.goldCupEditionId, match.goldCupRound,
      match.copaAmericaEditionId, match.copaAmericaRound,
      match.afconEditionId, match.afconRound,
      match.afcCupEditionId, match.afcCupRound,
      match.ofcCupEditionId, match.ofcCupRound
    ]);
    unique.set(identity, match);
  }

  const rows: NationMatchRow[] = [];
  for (const match of unique.values()) {
    if (match.home !== code && match.away !== code) continue;
    if (match.windowYear === undefined || !match.windowId || match.windowYear < currentYear) continue;
    const isHome = match.home === code;
    rows.push({
      year: match.windowYear,
      windowId: match.windowId,
      windowLabel: formatWindowLabel(match.windowYear, match.windowId),
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

/** Played matches and scheduled fixtures for a nation, oldest first. */
export function getNationMatches(state: InternationalState, code: string, currentYear: number): NationMatchRow[] {
  const rows = [...playedRows(state, code), ...scheduledRows(state, code, currentYear)];
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
