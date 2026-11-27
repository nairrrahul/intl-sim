import type { AfconState } from "./competitions/afcon";
import type { AfcCupState } from "./competitions/afcCup";
import type { ConfedCupState } from "./competitions/confedCup";
import type { U20WorldCupState } from "./competitions/u20WorldCup";
import type { CopaAmericaState } from "./competitions/copaAmerica";
import type { EuroQualifiersState } from "./competitions/euroQualifiers";
import type { EuroState } from "./competitions/euros";
import type { GoldCupState } from "./competitions/goldCup";
import type { NationsLeagueState } from "./competitions/nationsLeague";
import type { OfcCupState } from "./competitions/ofcCup";
import type { WorldCupState } from "./competitions/worldcup/types";
import { U20QualifyingState } from "./competitions/u20Qualifying";

/** A nation's formation, starting XI and substitutes for one of its teams. */
export interface SquadState {
  /** False when the squad could not be formed (the XI and substitutes are then empty). */
  formed: boolean;
  formation: string;
  /** True when the formation was chosen by hand (God Mode) instead of being the best available. */
  formationLocked: boolean;
  /** Player IDs aligned with the formation's required positions (null = unfilled slot). */
  startingXI: (string | null)[];
  substitutes: string[];
  /** Rounded average overall of the starting XI. */
  overall: number;
}

export interface GoldenGenerationInfo {
  startingNationalTeamRank: number;
  yearsLeft: number;
  amount: number;
}

export interface NationTeam {
  code: string;
  /** Rounded average overall of the starting XI (recalculated whenever squads are refreshed). */
  overall: number;
  /** FIFA ranking points. */
  points: number;
  /** Youth rating (0-200) that drives the quality of the nation's yearly newgen intake. */
  youthRating: number;
  /** Active golden generation, or null when the nation has none. */
  goldenGeneration: GoldenGenerationInfo | null;
  formation: string;
  /** True when the formation was chosen by hand (God Mode) instead of being the best available. */
  formationLocked: boolean;
  /** Player IDs aligned with the formation's required positions (null = unfilled slot). */
  startingXI: (string | null)[];
  /** The substitutes' player IDs. */
  substitutes: string[];
  /** The U20 team: players aged 20 or under who are not in the senior squad. */
  u20: SquadState;
}

export type MatchSide = "home" | "away";

export interface GoalEvent {
  minute: number;
  /** Frozen stoppage-time label, assigned the first time match details are opened. */
  displayMinute?: string;
  side: MatchSide;
  /** Player ID of the scorer. */
  scorerId: string;
  /** Player ID of the assister (null for a penalty, which has no assist). */
  assistId: string | null;
  /** True for a penalty, always taken by the team's highest-rated outfield player on the pitch. */
  penalty?: boolean;
}

export interface SubstitutionEvent {
  minute: number;
  side: MatchSide;
  /** Player ID of the player taken off. */
  offId: string;
  /** Player ID of the player brought on. */
  onId: string;
}

/** One tier of a predicted final ranking (e.g. "Quarter-Finalists") with its teams in rank order. */
export interface PredictedTier {
  label: string;
  teams: string[];
}

/** A player in a competition's top-10 for goals, assists or clean sheets. */
export interface StatLeader {
  playerId: string;
  nation: string;
  value: number;
  /** Games played in the competition (fewer is better when values tie). */
  games: number;
}

export interface StatLeaders {
  goals: StatLeader[];
  assists: StatLeader[];
  cleanSheets: StatLeader[];
}

/** Everything that is known about a match once it has been played. */
export interface MatchGoalInfo {
  homeGoals: number;
  awayGoals: number;
  /** Ranking-point change of each side (0 for U20 matches, which do not move the senior rankings). */
  homeChange: number;
  awayChange: number;

  /** Goals in minute order. */
  goals: GoalEvent[];

  /** Players who appeared, per side (only recorded for tournament matches, to power competition stats). */
  appearances: Record<MatchSide, string[]>;

  /** Goalkeepers credited with a clean sheet, per side (tournament matches only). */
  cleanSheets: Partial<Record<MatchSide, string>>;

  /** Substitutions relevant to goals and assists: those that brought on a goalscorer or assister. */
  substitutions: SubstitutionEvent[];
}

/** Nations League metadata. All fields are always populated. */
export interface NationsLeagueOptions {
  leagueId: string;
  leagueConfederation: string;
  leagueDivision: string;
  leagueGroup: string;
  leagueRound: number;
}

/** The international window a match is played in. */
export interface WindowOptions {
  windowYear: number;
  windowId: string;
}

/** Ranking and overall values captured just before a (senior) match is played. */
export interface MatchChangeOptions {
  homeRankBefore: number;
  awayRankBefore: number;
  homeOverallBefore: number;
  awayOverallBefore: number;
}

export type CompetitionName =
  | "goldCup"
  | "copaAmerica"
  | "confedCup"
  | "u20WorldCup"
  | "u20Qualifier"
  | "afcon"
  | "afcCup"
  | "ofcCup"
  | "euro"
  | "worldCup";

/**
 * Which competition, which tournament and which phase a match belongs to. A match belongs to exactly one phase:
 * qualifying, playoff or finals. Which stage identifiers are valid for each competition is checked by the
 * application (see competitionStages.ts), not by this type.
 */
export type CompetitionOptions =
  | {
      competitionName: CompetitionName;
      tournamentYear: number;
      qualifyingInfo: QualifyingOptions;
      playoffOptions?: never;
      finalsInfo?: never;
    }
  | {
      competitionName: CompetitionName;
      tournamentYear: number;
      qualifyingInfo?: never;
      playoffOptions: PlayoffOptions;
      finalsInfo?: never;
    }
  | {
      competitionName: CompetitionName;
      tournamentYear: number;
      qualifyingInfo?: never;
      playoffOptions?: never;
      finalsInfo: FinalCompOptions;
    };

/** Ordinary qualifying matches (groups, preliminary ties, ...). */
export interface QualifyingOptions {
  /** Qualifying competition/edition identifier, when applicable. */
  qualifierId?: string;

  /** Existing qualifying stage identifier. */
  stage: string;

  /** Confederation associated with the qualifying competition. */
  confederation?: string;

  /** Group-stage information. */
  group?: string;
  round?: number;

  /** Two-legged qualifying tie information. */
  tieId?: string;
  leg?: 1 | 2;

  /** Knockout match identifier, when used outside playoff metadata. */
  knockoutMatchId?: string;

  /**
   * Position of the fixture within its round (World Cup qualifying group matches).
   * Not part of the originally specified interface: current code records it on qualifying group fixtures.
   */
  matchIndex?: number;
}

/** Playoff matches (paths, bracket knockouts and two-legged playoff ties). */
export interface PlayoffOptions {
  /** Existing playoff identifier. */
  playoffId?: string;

  /** Confederation or playoff region; "ICPO" for intercontinental playoffs. */
  confederation?: string;

  /** Existing playoff stage identifier. */
  stage: string;

  /** Playoff path information. */
  path?: string;
  pathRound?: number;
  pathMatch?: number;

  /** Tie information, when the playoff uses a two-legged format. */
  tieId?: string;
  leg?: 1 | 2;

  /** Knockout match identifier, if used by the existing playoff logic. */
  knockoutMatchId?: string;

  /** Existing match index, when applicable. */
  matchIndex?: number;

  /**
   * Winner of the match once decided (set by the knockout logic; the playoff bracket reads it back).
   * Not part of the originally specified interface: current code records it on playoff fixtures.
   */
  winner?: string;
}

/** Finals-tournament matches (group stage and knockout). Finals matches are single-legged: there is no `leg`. */
export interface FinalCompOptions {
  /** Finals edition identifier. */
  editionId?: string;

  /** Existing finals stage identifier. */
  stage: string;

  /** Additional phase identifier, where applicable. */
  phase?: string;

  /** Group-stage information. */
  group?: string;
  round?: number;

  /** Knockout match identifier. */
  knockoutMatchId?: string;

  /** Tournament winner, once determined. */
  winner?: string;
}

export interface InternationalMatch {
  home: string;
  away: string;
  kind: string;

  /** Null until the match has been played. */
  goalInfo: MatchGoalInfo | null;

  /** Penalty shootout results, when applicable. */
  homePenalties?: string[];
  awayPenalties?: string[];

  /** God Mode: the result this match is forced to when played (a drawn knockout goes to random penalties). */
  rigged?: {
    homeGoals: number;
    awayGoals: number;
  };

  /** Nations League metadata; null for non-Nations League matches. */
  nationsLeagueInfo: NationsLeagueOptions | null;

  /** International window metadata; null when not applicable (yet). */
  windowInfo: WindowOptions | null;

  /** Competition metadata; null for non-competition matches. */
  competitionInformation: CompetitionOptions | null;

  /** Ranking and overall values captured before the match. */
  matchChangeInfo: MatchChangeOptions | null;
}

export interface InternationalRound {
  matches: InternationalMatch[];
  kind?: "friendly" | "nationsLeague" | "goldCupPlayoff" | "goldCup" | "copaAmerica" | "confedCup" | "u20WorldCup" | "u20Qualifier" | "afconQualifier" | "afcon" | "afcCupQualifier" | "afcCup" | "ofcCupQualifier" | "ofcCup" | "euroQualifier" | "euro" | "worldCupQualifier" | "worldCup";
  label?: string;
  afconQualifierId?: string;
  afconStage?: "preliminary" | "main" | "tournamentGroup" | "tournamentKnockout";
  afconRound?: number;
  afcCupQualifierId?: string;
  afcCupStage?: "preliminary" | "main" | "group" | "knockout";
  afcCupRound?: number;
  ofcCupQualifierId?: string;
  ofcCupStage?: "qualifying" | "group" | "knockout";
  ofcCupRound?: number;
  euroQualifierId?: string;
  euroStage?: "qualifying" | "playoff" | "group" | "knockout";
  euroRound?: number;
  euroTournamentYear?: number;
  worldCupEditionId?: string;
  worldCupStage?: string;
  worldCupPhase?: string;
  worldCupRound?: number;
  /** The one nation without a match in this set of fixtures (there is an odd number of nations). */
  leftOut: string | null;
}

/**
 * A round placed in a window. Rounds are left-aligned by competition: matchday N of a window
 * plays the Nth round of every lane (competition strand) that still has one.
 */
export interface ScheduledRound extends InternationalRound {
  /** Competition strand the round belongs to (see getLaneKey). */
  lane: string;
  /** 1-based matchday within the window. */
  matchday: number;
}

export interface WindowRecord {
  year: number;
  windowId: string;
  label: string;
  status: "scheduled" | "played";
  /** Matchdays of this window that have been simulated so far. */
  matchdaysPlayed: number;
  rounds: ScheduledRound[];
  /** Nation code -> IDs of the players called up for this window. */
  callUps: Record<string, string[]>;
}

export interface RankingSnapshot {
  year: number;
  windowId: string;
  label: string;
  /** Nations in rank order (index 0 = rank 1) with their points after the window. */
  ranks: [string, number][];
}

export interface InternationalState {
  nations: Record<string, NationTeam>;
  windows: WindowRecord[];
  rankingHistory: RankingSnapshot[];
  nationsLeague: NationsLeagueState;
  goldCup: GoldCupState;
  copaAmerica: CopaAmericaState;
  confedCup: ConfedCupState;
  u20WorldCup: U20WorldCupState;
  u20Qualifying: U20QualifyingState;
  afcon: AfconState;
  afcCup: AfcCupState;
  ofcCup: OfcCupState;
  euroQualifiers: EuroQualifiersState;
  euro: EuroState;
  worldCup: WorldCupState;
  /** The nation left out of the most recent set of fixtures (never left out twice in a row). */
  lastLeftOut: string | null;
  /** The season whose player ratings the nations' squads were last built from (squads only change at rollover). */
  squadsSeason?: number;
  upsets: UpsetHistory;
}

export interface MatchUpsetRecord {
  year: number;
  windowId: string;
  matchday: number;
  kind: string;

  home: string;
  away: string;
  winner: string;
  loser: string;

  homeGoals: number;
  awayGoals: number;

  homeRank: number;
  awayRank: number;
  homeOverall: number;
  awayOverall: number;

  rankingDifference: number;
  rankingUnderdogRank: number;

  ratingDifference: number;
  ratingUnderdogOverall: number;

  worldCupPhase?: string;
  worldCupStage?: string;
}

export interface UpsetHistory {
  ranking: MatchUpsetRecord[];
  rating: MatchUpsetRecord[];
  tournamentWinners: TournamentUpsetRecord[];
  tournamentPlacings: TournamentUpsetRecord[];
  nonWorldCupTournamentPlacings: TournamentUpsetRecord[];
}

export interface TournamentUpsetRecord {
  code: string;
  competition: string;
  year: number;
  expected: number;
  actual: number;
  expectedStage: string;
  actualStage: string;
  delta: number;
  worldRank: number;
}