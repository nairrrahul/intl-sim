import type {
  CompetitionName, CompetitionOptions, FinalCompOptions, InternationalMatch, MatchChangeOptions, PlayoffOptions,
  QualifyingOptions
} from "../international/types";
import { WORLD_CUP_PLAYOFF_ONLY_PHASES } from "../international/competitions/worldcup/phases";

/**
 * Save compatibility: saves up to version 2 stored every InternationalMatch as one flat object with
 * competition-prefixed fields (`afconStage`, `worldCupPathMatch`, ...). This converts such matches, in place, to the
 * nested structure (goalInfo, nationsLeagueInfo, windowInfo, competitionInformation, matchChangeInfo).
 *
 * The conversion is in place on purpose: a fixture is shared between group tables, rounds and brackets, and the
 * save graph must keep it a single object. Nothing is dropped: every legacy field is carried over or deleted only
 * after it has been mapped.
 */

type Legacy = Record<string, unknown>;

const CUPS: CompetitionName[] = ["goldCup", "copaAmerica", "confedCup", "u20WorldCup", "afcon", "afcCup", "ofcCup"];
const PREFIXED: CompetitionName[] = [...CUPS, "u20Qualifier", "euro", "worldCup"];
const SUFFIXES = [
  "EditionId", "QualifierId", "PlayoffId", "TieId", "Stage", "Phase", "Group", "Round", "Leg", "KnockoutMatchId",
  "Winner", "Path", "PathRound", "PathMatch", "MatchIndex", "TournamentYear", "Confederation"
];
const FLAT_KEYS = new Set<string>([
  "homeGoals", "awayGoals", "homeChange", "awayChange", "goals", "appearances", "cleanSheets", "substitutions",
  "windowYear", "windowId", "homeRankBefore", "awayRankBefore", "homeOverallBefore", "awayOverallBefore",
  "nationsLeagueId", "nationsLeagueConfederation", "nationsLeagueDivision", "nationsLeagueGroup", "nationsLeagueRound",
  ...PREFIXED.flatMap(prefix => SUFFIXES.map(suffix => `${prefix}${suffix}`))
]);

export function isLegacyMatch(value: unknown): value is Legacy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Legacy;
  return typeof candidate.home === "string" && typeof candidate.away === "string" && typeof candidate.kind === "string" &&
    "homeGoals" in candidate && "homeChange" in candidate && !("goalInfo" in candidate);
}

const clean = <T extends object>(object: T): T => {
  for (const key of Object.keys(object) as (keyof T)[]) if (object[key] === undefined) delete object[key];
  return object;
};

/** Year of an ID such as `WCQ-2026`, `GCPO-2026-IW1`: the second segment. */
const yearFromId = (id: string | undefined): number | undefined => {
  const year = Number(id?.split("-")[1]);
  return Number.isInteger(year) ? year : undefined;
};

function convertCompetition(m: Legacy, yearById: Map<string, number>): CompetitionOptions | null {
  const prefix = PREFIXED.find(name => SUFFIXES.some(suffix => m[`${name}${suffix}`] !== undefined));
  if (!prefix) return null;
  const f = <T>(suffix: string) => m[`${prefix}${suffix}`] as T | undefined;
  const windowYear = m.windowYear as number | undefined;
  let stage = f<string>("Stage");
  const editionId = f<string>("EditionId");
  const qualifierId = f<string>("QualifierId");
  const playoffId = f<string>("PlayoffId");
  const tieId = f<string>("TieId");
  const leg = f<1 | 2>("Leg");
  const group = f<string>("Group");
  const round = f<number>("Round");
  const knockoutMatchId = f<string>("KnockoutMatchId");
  const winner = f<string>("Winner");
  const path = f<string>("Path");

  const qualifying = (details: QualifyingOptions, year: number | undefined): CompetitionOptions => ({
    competitionName: prefix, tournamentYear: year ?? windowYear ?? 0, qualifyingInfo: clean(details)
  });
  const playoff = (details: PlayoffOptions, year: number | undefined): CompetitionOptions => ({
    competitionName: prefix, tournamentYear: year ?? windowYear ?? 0, playoffOptions: clean(details)
  });
  const finals = (details: FinalCompOptions, year: number | undefined): CompetitionOptions => ({
    competitionName: prefix, tournamentYear: year ?? windowYear ?? 0, finalsInfo: clean(details)
  });
  const ownerYear = (id: string | undefined) => (id ? yearById.get(id) : undefined);

  switch (prefix) {
    case "goldCup":
      if (playoffId) {
        return playoff({ playoffId, stage: "playoff", tieId, leg }, yearFromId(playoffId));
      }
      return finals({ editionId, stage: stage!, group, round, knockoutMatchId, winner }, ownerYear(editionId));
    case "u20Qualifier": {
      const confederation = f<string>("Confederation");
      const owner = f<string>("EditionId");
      if (stage === "playoff") {
        return playoff({ playoffId: owner, confederation, stage, knockoutMatchId }, ownerYear(owner));
      }
      return qualifying({ qualifierId: owner, confederation, stage: stage!, group, round, tieId, leg }, ownerYear(owner));
    }
    case "euro": {
      const year = f<number>("TournamentYear");
      if (stage === "qualifying") {
        return qualifying({ qualifierId, stage, group, round }, year);
      }
      if (stage === "playoff") {
        return playoff({
          playoffId: qualifierId, stage, path, pathRound: f<number>("PathRound"), pathMatch: f<number>("PathMatch"), winner
        }, year);
      }
      return finals({ editionId, stage: stage!, group, round, knockoutMatchId, winner }, year ?? ownerYear(editionId));
    }
    case "worldCup": {
      const owner = editionId ?? qualifierId ?? playoffId;
      const year = yearFromId(owner) ?? yearFromId(tieId ? `WCQ-${tieId.split("-")[1]}` : undefined);
      const phase = f<string>("Phase");
      stage ??= phase ?? tieId?.split("-")[0];
      const isFinals = m.kind === "worldCupGroup" || m.kind === "worldCupKnockout" || stage === "group" || stage === "knockout";
      if (isFinals) {
        return finals({ editionId: owner, stage: stage!, phase, group, round, knockoutMatchId, winner }, year);
      }
      const owningId = owner ?? (tieId ? `WCQ-${tieId.split("-")[1]}` : undefined);
      if (path !== undefined || WORLD_CUP_PLAYOFF_ONLY_PHASES.has(stage!)) {
        return playoff({
          playoffId: owningId, stage: stage!, path, pathRound: f<number>("PathRound"), pathMatch: f<number>("PathMatch"),
          tieId, leg, knockoutMatchId, matchIndex: f<number>("MatchIndex"), winner
        }, year);
      }
      return qualifying({
        qualifierId: owningId, stage: stage!, group, round, tieId, leg, knockoutMatchId, matchIndex: f<number>("MatchIndex")
      }, year);
    }
    default: {
      // goldCup is handled above; the remaining cups share one pattern (qualifying editions or finals editions).
      const isQualifying = stage === "preliminary" || stage === "main" || stage === "qualifying";
      if (isQualifying) {
        const owner = qualifierId ?? editionId;
        return qualifying({ qualifierId: owner, stage: stage!, group, round, tieId, leg }, ownerYear(owner));
      }
      return finals({ editionId, stage: stage!, group, round, knockoutMatchId, winner }, ownerYear(editionId));
    }
  }
}

function convertMatch(m: Legacy, yearById: Map<string, number>): void {
  const num = (key: string) => m[key] as number;
  const played = m.homeGoals !== null && m.homeGoals !== undefined && m.awayGoals !== null && m.awayGoals !== undefined;
  const goalInfo = played ? {
    homeGoals: num("homeGoals"),
    awayGoals: num("awayGoals"),
    homeChange: (m.homeChange as number | null | undefined) ?? 0,
    awayChange: (m.awayChange as number | null | undefined) ?? 0,
    goals: m.goals ?? [],
    appearances: m.appearances ?? { home: [], away: [] },
    cleanSheets: m.cleanSheets ?? {},
    substitutions: m.substitutions ?? []
  } : null;
  const nationsLeagueInfo = m.nationsLeagueId === undefined ? null : {
    leagueId: m.nationsLeagueId, leagueConfederation: m.nationsLeagueConfederation,
    leagueDivision: m.nationsLeagueDivision, leagueGroup: m.nationsLeagueGroup, leagueRound: m.nationsLeagueRound
  };
  const windowInfo = m.windowYear !== undefined && m.windowId !== undefined
    ? { windowYear: m.windowYear, windowId: m.windowId } : null;
  const matchChangeInfo: MatchChangeOptions | null = m.homeRankBefore === undefined ? null : {
    homeRankBefore: num("homeRankBefore"), awayRankBefore: num("awayRankBefore"),
    homeOverallBefore: num("homeOverallBefore"), awayOverallBefore: num("awayOverallBefore")
  };
  const competitionInformation = convertCompetition(m, yearById);

  for (const key of Object.keys(m)) if (FLAT_KEYS.has(key)) delete m[key];
  Object.assign(m, { goalInfo, nationsLeagueInfo, windowInfo, competitionInformation, matchChangeInfo });
}

/** Converts every legacy flat match reachable from `root` (typically `world.international`). Returns how many. */
export function migrateLegacyMatches(root: unknown): number {
  const visited = new Set<object>();
  const legacy: Legacy[] = [];
  const yearById = new Map<string, number>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (isLegacyMatch(value)) legacy.push(value);
    else {
      const record = value as Legacy;
      if (typeof record.id === "string" && typeof record.year === "number" && !yearById.has(record.id)) {
        yearById.set(record.id, record.year);
      }
    }
    for (const child of Object.values(value)) stack.push(child);
  }
  for (const match of legacy) convertMatch(match, yearById);
  return legacy.length;
}

export type { InternationalMatch };
