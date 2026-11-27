import { assertValidCompetitionInformation } from "./competitionStages";
import type {
  CompetitionName, CompetitionOptions, FinalCompOptions, InternationalMatch, MatchGoalInfo, NationsLeagueOptions,
  PlayoffOptions, QualifyingOptions, WindowOptions
} from "./types";

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export const windowOptions = (windowYear: number, windowId: string): WindowOptions => ({ windowYear, windowId });

/** Metadata a freshly created fixture can carry. Anything left out stays null. */
export interface MatchParts {
  windowInfo?: WindowOptions | null;
  nationsLeagueInfo?: NationsLeagueOptions | null;
  competitionInformation?: CompetitionOptions | null;
}

/** An unplayed fixture: no result, no pre-match snapshot, and only the metadata given. */
export function createMatch(home: string, away: string, kind: string, parts: MatchParts = {}): InternationalMatch {
  const competitionInformation = parts.competitionInformation ?? null;
  if (competitionInformation) assertValidCompetitionInformation(competitionInformation);
  return {
    home,
    away,
    kind,
    goalInfo: null,
    nationsLeagueInfo: parts.nationsLeagueInfo ?? null,
    windowInfo: parts.windowInfo ?? null,
    competitionInformation,
    matchChangeInfo: null
  };
}

export const qualifyingCompetition = (
  competitionName: CompetitionName, tournamentYear: number, qualifyingInfo: QualifyingOptions
): CompetitionOptions => ({ competitionName, tournamentYear, qualifyingInfo });

export const playoffCompetition = (
  competitionName: CompetitionName, tournamentYear: number, playoffOptions: PlayoffOptions
): CompetitionOptions => ({ competitionName, tournamentYear, playoffOptions });

export const finalsCompetition = (
  competitionName: CompetitionName, tournamentYear: number, finalsInfo: FinalCompOptions
): CompetitionOptions => ({ competitionName, tournamentYear, finalsInfo });

/** Puts a fixture (that was drawn before it was scheduled) into a competition phase. */
export function setCompetitionInformation(match: InternationalMatch, info: CompetitionOptions): void {
  assertValidCompetitionInformation(info);
  match.competitionInformation = info;
}

export function setWindow(match: InternationalMatch, windowYear: number, windowId: string): void {
  match.windowInfo = windowOptions(windowYear, windowId);
}

/** A result with no match story yet: the details are filled in once the match has been played. */
export function createGoalInfo(homeGoals: number, awayGoals: number, homeChange = 0, awayChange = 0): MatchGoalInfo {
  return {
    homeGoals, awayGoals, homeChange, awayChange,
    goals: [],
    appearances: { home: [], away: [] },
    cleanSheets: {},
    substitutions: []
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type PlayedMatch = InternationalMatch & { goalInfo: MatchGoalInfo };

export const isPlayed = (match: InternationalMatch): match is PlayedMatch => match.goalInfo !== null;

export const getCompetitionName = (match: InternationalMatch): CompetitionName | null =>
  match.competitionInformation?.competitionName ?? null;

/** The qualifying metadata of a match (of `name` only, when given). */
export function getQualifying(match: InternationalMatch, name?: CompetitionName): QualifyingOptions | undefined {
  const info = match.competitionInformation;
  return info && (name === undefined || info.competitionName === name) ? info.qualifyingInfo : undefined;
}

export function getPlayoff(match: InternationalMatch, name?: CompetitionName): PlayoffOptions | undefined {
  const info = match.competitionInformation;
  return info && (name === undefined || info.competitionName === name) ? info.playoffOptions : undefined;
}

export function getFinals(match: InternationalMatch, name?: CompetitionName): FinalCompOptions | undefined {
  const info = match.competitionInformation;
  return info && (name === undefined || info.competitionName === name) ? info.finalsInfo : undefined;
}

/** The stage of whichever phase the match is in. */
export function getStage(match: InternationalMatch, name?: CompetitionName): string | undefined {
  return (getQualifying(match, name) ?? getPlayoff(match, name) ?? getFinals(match, name))?.stage;
}

/** The knockout match ID of a finals or playoff match (qualifying matches may carry one too). */
export function getKnockoutMatchId(match: InternationalMatch, name?: CompetitionName): string | undefined {
  return (getFinals(match, name) ?? getPlayoff(match, name) ?? getQualifying(match, name))?.knockoutMatchId;
}

/** The winner recorded on a knockout, playoff or finals fixture. */
export function getMatchWinner(match: InternationalMatch): string | undefined {
  return getFinals(match)?.winner ?? getPlayoff(match)?.winner;
}

export function setMatchWinner(match: InternationalMatch, winner: string): void {
  const details = getFinals(match) ?? getPlayoff(match);
  if (details) details.winner = winner;
}

/** The identifier of the edition (finals), qualifier or playoff that owns the match. */
export function getOwnerId(match: InternationalMatch, name?: CompetitionName): string | undefined {
  return getFinals(match, name)?.editionId ?? getQualifying(match, name)?.qualifierId ?? getPlayoff(match, name)?.playoffId;
}

// ---------------------------------------------------------------------------
// Phase-independent view
// ---------------------------------------------------------------------------

/** The metadata of whichever phase a match is in, in one flat shape (for display and look-ups). */
export interface PhaseDetails {
  /** Edition (finals), qualifier or playoff identifier that owns the match. */
  ownerId?: string;
  stage?: string;
  phase?: string;
  confederation?: string;
  group?: string;
  round?: number;
  tieId?: string;
  leg?: 1 | 2;
  knockoutMatchId?: string;
  path?: string;
  pathRound?: number;
  pathMatch?: number;
  matchIndex?: number;
  winner?: string;
}

export function getPhaseDetails(match: InternationalMatch): PhaseDetails {
  const info = match.competitionInformation;
  if (!info) return {};
  if (info.qualifyingInfo) {
    const { qualifierId, ...rest } = info.qualifyingInfo;
    return { ownerId: qualifierId, ...rest };
  }
  if (info.playoffOptions) {
    const { playoffId, ...rest } = info.playoffOptions;
    return { ownerId: playoffId, ...rest };
  }
  const { editionId, ...rest } = info.finalsInfo!;
  return { ownerId: editionId, ...rest };
}
