export type Position =
  | "GK" | "RB" | "CB" | "LB" | "CDM" | "CM" | "CAM"
  | "RM" | "LM" | "RW" | "LW" | "ST";

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export type PlayerType = "NORMAL" | "LATE BLOOMER" | "PRODIGY" | "BURNOUT";

export interface PeakRange {
  start: number;
  end: number;
}

/** One row of a player's season-by-season history (state at the start of a season, plus the caps won in it). */
export interface ProgressionEntry {
  year: number;
  age: number;
  overall: number;
  potential: number;
  /** Caps won during the season. Rows are only added while the player is active. */
  caps: number;
  goals: number;
  assists: number;
  /** Clean sheets kept (goalkeepers only). */
  cleanSheets: number;
  /** Trophies won with the national team during the season (competition names). */
  trophies: string[];
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** Name the player is known by (e.g. "Neymar"); shown instead of first + last name when set. */
  commonName: string | null;
  primaryNationality: string;
  secondaryNationality: string | null;
  age: number;
  overall: number;
  potential: number;
  position: Position;
  playerType: PlayerType | null;
  peakRange: PeakRange | null;
  progression: ProgressionEntry[];
  /** Caps for the national team of the player's primary nationality. */
  caps: number;
  /** Appearances for the U20 team of the player's nation (these are not senior caps). */
  u20Caps: number;
  isShortlisted: boolean;
  /** Season year at the end of which the player retires (null = not retiring). */
  retirementYear: number | null;
  isRetired: boolean;
}
