import type { Position, PositionGroup } from "./types";

export const POSITION_ORDER: Position[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "ST"];

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  GK: "GK", RB: "DEF", CB: "DEF", LB: "DEF",
  CDM: "MID", CM: "MID", CAM: "MID", RM: "MID", LM: "MID",
  RW: "FWD", LW: "FWD", ST: "FWD"
};

/** Position pool newly generated players are drawn from (repeats weight the draw). */
export const POSITION_DISTRIBUTION: Position[] = [
  "GK", "GK", "GK",
  "RB", "RB",
  "CB", "CB", "CB", "CB",
  "LB", "LB",
  "CDM", "CDM",
  "CM", "CM",
  "CAM", "CAM",
  "RM", "RM",
  "LM", "LM",
  "RW", "LW", "ST", "ST"
];
