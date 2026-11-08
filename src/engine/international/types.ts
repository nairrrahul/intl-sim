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

export interface NationTeam {
  code: string;
  /** Rounded average overall of the starting XI (recalculated whenever squads are refreshed). */
  overall: number;
  /** FIFA ranking points. */
  points: number;
  /** Youth rating (0-200) that drives the quality of the nation's yearly newgen intake. */
  youthRating: number;
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

export interface InternationalMatch {
  home: string;
  away: string;
  kind: string;
  /** null until the window is simulated. */
  homeGoals: number | null;
  awayGoals: number | null;
  homeChange: number | null;
  awayChange: number | null;
  /** Goals of the match in minute order (set once it has been played). */
  goals?: GoalEvent[];
  /** Players who played, per side (only recorded for tournament matches, to power competition stats). */
  appearances?: Record<MatchSide, string[]>;
  /** Goalkeepers credited with a clean sheet, per side (tournament matches only). */
  cleanSheets?: Partial<Record<MatchSide, string>>;
  /** Substitutions that matter to the match story: those that brought on a goalscorer or assister. */
  substitutions?: SubstitutionEvent[];
  /** God Mode: the result this match is forced to when played (a drawn knockout goes to random penalties). */
  rigged?: { homeGoals: number; awayGoals: number };
  nationsLeagueId?: string;
  nationsLeagueConfederation?: string;
  nationsLeagueDivision?: string;
  nationsLeagueGroup?: string;
  nationsLeagueRound?: number;
  windowYear?: number;
  windowId?: string;
  goldCupPlayoffId?: string;
  goldCupTieId?: string;
  goldCupLeg?: 1 | 2;
  goldCupEditionId?: string;
  goldCupStage?: "group" | "knockout";
  goldCupGroup?: string;
  goldCupRound?: number;
  goldCupKnockoutMatchId?: string;
  goldCupWinner?: string;
  copaAmericaEditionId?: string;
  copaAmericaStage?: "group" | "knockout";
  copaAmericaGroup?: string;
  copaAmericaRound?: number;
  copaAmericaKnockoutMatchId?: string;
  copaAmericaWinner?: string;
  confedCupEditionId?: string;
  confedCupStage?: "group" | "knockout";
  confedCupGroup?: string;
  confedCupRound?: number;
  confedCupKnockoutMatchId?: string;
  confedCupWinner?: string;
  u20WorldCupEditionId?: string;
  u20WorldCupStage?: "group" | "knockout";
  u20WorldCupGroup?: string;
  u20WorldCupRound?: number;
  u20WorldCupKnockoutMatchId?: string;
  u20WorldCupWinner?: string;
  afconEditionId?: string;
  afconQualifierId?: string;
  afconTieId?: string;
  afconStage?: "preliminary" | "main" | "group" | "knockout";
  afconGroup?: string;
  afconRound?: number;
  afconLeg?: 1 | 2;
  afconKnockoutMatchId?: string;
  afconWinner?: string;
  afcCupEditionId?: string;
  afcCupQualifierId?: string;
  afcCupTieId?: string;
  afcCupStage?: "preliminary" | "main" | "group" | "knockout";
  afcCupGroup?: string;
  afcCupRound?: number;
  afcCupLeg?: 1 | 2;
  afcCupKnockoutMatchId?: string;
  afcCupWinner?: string;
  ofcCupEditionId?: string;
  ofcCupQualifierId?: string;
  ofcCupStage?: "qualifying" | "group" | "knockout";
  ofcCupGroup?: string;
  ofcCupRound?: number;
  ofcCupKnockoutMatchId?: string;
  ofcCupWinner?: string;
  euroEditionId?: string;
  euroQualifierId?: string;
  euroStage?: "qualifying" | "playoff" | "group" | "knockout";
  euroGroup?: string;
  euroRound?: number;
  euroTournamentYear?: number;
  euroPath?: string;
  euroPathRound?: number;
  euroPathMatch?: number;
  euroWinner?: string;
  euroKnockoutMatchId?: string;
  worldCupEditionId?: string;
  worldCupStage?: string;
  worldCupPhase?: string;
  worldCupGroup?: string;
  worldCupRound?: number;
  worldCupLeg?: 1 | 2;
  worldCupTieId?: string;
  worldCupPath?: string;
  worldCupPathRound?: number;
  worldCupPathMatch?: number;
  worldCupMatchIndex?: number;
  worldCupWinner?: string;
  worldCupKnockoutMatchId?: string;
  homePenalties?: string[];
  awayPenalties?: string[];
}

export interface InternationalRound {
  matches: InternationalMatch[];
  kind?: "friendly" | "nationsLeague" | "goldCupPlayoff" | "goldCup" | "copaAmerica" | "confedCup" | "u20WorldCup" | "afconQualifier" | "afcon" | "afcCupQualifier" | "afcCup" | "ofcCupQualifier" | "ofcCup" | "euroQualifier" | "euro" | "worldCupQualifier" | "worldCup";
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
}
