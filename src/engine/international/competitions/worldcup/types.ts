import type { Bracket } from "../../../shared/bracketTypes";
import type { InternationalCompetitionGroup } from "../cupCommon";
import type { InternationalMatch, PredictedTier, StatLeaders } from "../../types";

export type WorldCupConfederation = "UEFA" | "CONCACAF" | "CONMEBOL" | "OFC" | "AFC" | "CAF" | "ICPO";

export interface WorldCupTie {
  id: string;
  team1: string;
  team2: string;
  firstLeg: InternationalMatch;
  secondLeg: InternationalMatch;
  winner: string | null;
}

export interface WorldCupPath {
  name: string;
  teams: string[];
  bracket: Bracket<string>;
  results: Record<string, { homeGoals: number; awayGoals: number; homePenalties?: string[]; awayPenalties?: string[]; /** The played match (for its match report). */ fixture?: InternationalMatch }>;
}

export interface WorldCupPhase {
  groups: InternationalCompetitionGroup[];
  roundsPlayed: number;
  completed: boolean;
  qualifiers: string[];
  playoffTeams: string[];
  bottomSeeds: string[];
  ties: WorldCupTie[];
  paths: WorldCupPath[];
  playoffRoundsPlayed: number;
  playoffComplete: boolean;
}

export interface WorldCupRegionalQualifying {
  confederation: WorldCupConfederation;
  teams: string[];
  phases: Record<string, WorldCupPhase>;
  qualified: string[];
  intercontinental: string[];
  playoffQualifiers: string[];
  playoffBottomSeeds: string[];
}

export interface WorldCupTournament {
  id: string;
  year: number;
  hosts: string[];
  teams: string[];
  pots: string[][];
  seedRanks: Record<string, number>;
  groups: InternationalCompetitionGroup[];
  knockout: {
    label: "Round of 32" | "Round of 16" | "Quarter-finals" | "Semi-finals" | "Final";
    matches: { id: string; home: string; away: string; fixture: InternationalMatch; winner: string | null }[];
  }[] | null;
  completed: boolean;
  winner: string | null;
  runnerUp: string | null;
  /** Winner of the third-place match. */
  thirdPlace?: string | null;
  trophyAwarded?: boolean;
  predictedRanking?: PredictedTier[];
  statLeaders?: StatLeaders;
  semifinalists: string[];
  playoffTeams: string[];
}

export interface WorldCupEdition {
  id: string;
  year: number;
  hosts: string[];
  blockedConfederations: WorldCupConfederation[];
  seedRanks: Record<string, number>;
  regions: Record<Exclude<WorldCupConfederation, "ICPO">, WorldCupRegionalQualifying>;
  intercontinental: WorldCupRegionalQualifying;
  tournament: WorldCupTournament | null;
}

export interface WorldCupState {
  editions: WorldCupEdition[];
}
