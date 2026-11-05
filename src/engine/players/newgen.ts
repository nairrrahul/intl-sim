import { gauss, pickRandom, randInt, shuffledCopy, truncatedNormal, uniform } from "../shared/random";
import { generatePlayerName } from "./names/nameGenerator";
import {
  ABILITY_MAX, NEWGEN_AGE, NEWGENS_PER_NATION, RATING_MAX, RATING_MIN, WONDERKIDS_PER_SEASON,
  WONDERKID_ELIGIBILITY_CEILING, WONDERKID_OVERALL_SHARE_MAX, WONDERKID_OVERALL_SHARE_MIN,
  WONDERKID_POTENTIAL_MAX, WONDERKID_POTENTIAL_MIN
} from "./config";
import { createSeasonRow } from "./progression";
import type { Player, Position } from "./types";

const AGE_PERCENT: Record<number, number> = { 15: 0.3, 16: 0.45, 17: 0.6 };

/**
 * Generates a newgen's current and potential ability on a 1-200 scale from a nation's youth rating.
 * Potential is drawn around 40 + 0.7 * youthRating (with a rare outlier); current ability is a
 * share of potential that grows with age.
 */
export function generateNewgenAbility(youthRating: number, age: number, isCrucialImportance: boolean) {
  if (age > 17 || age < 15 || youthRating > 200 || youthRating < 0) {
    throw new Error("Invalid age or youth rating for generating a newgen");
  }

  const meanPA = 40 + 0.7 * Math.max(1, Math.min(200, youthRating));
  const stddevPA = Math.max(8.0, 20.0 - 0.05 * Math.max(0, youthRating));

  const chanceOutlier = 0.01;
  let potentialRaw: number;
  if (Math.random() < chanceOutlier) {
    potentialRaw = meanPA + uniform(25, 45) + gauss(0, stddevPA * 0.6);
  } else {
    potentialRaw = truncatedNormal(!isCrucialImportance ? meanPA : meanPA + 10, stddevPA, 1.0, 200.0);
  }
  const potential = Math.round(Math.max(1, Math.min(200, potentialRaw)));

  const noiseStddev = Math.max(2.0, 0.03 * potential);
  const currentRaw = potential * AGE_PERCENT[age] + gauss(0, noiseStddev);
  const current = Math.min(Math.round(currentRaw), potential - 1);

  return {
    currentAbility: Math.min(Math.max(1, Math.min(200, current)), potential),
    potentialAbility: potential
  };
}

/** Maps a 1-200 ability onto this game's player rating scale. */
export function abilityToRating(ability: number): number {
  return Math.round(RATING_MIN + ((ability - 1) * (RATING_MAX - RATING_MIN)) / (ABILITY_MAX - 1));
}

const MIDFIELD_POSITIONS: Position[] = ["CDM", "CM", "CAM", "RM", "LM"];
const ATTACK_POSITIONS: Position[] = ["ST", "RW", "LW"];
const DEFENCE_POSITIONS: Position[] = ["CB", "RB", "LB"];

/** The 11 positions of a newgen intake: 1 GK; 4 DEF (CB, RB, LB + 1); 3 MID (CM + 2); 3 FWD (ST + 2). */
export function pickNewgenPositions(): Position[] {
  return [
    "GK",
    "CB", "RB", "LB", pickRandom(DEFENCE_POSITIONS),
    "CM", pickRandom(MIDFIELD_POSITIONS), pickRandom(MIDFIELD_POSITIONS),
    "ST", pickRandom(ATTACK_POSITIONS), pickRandom(ATTACK_POSITIONS)
  ];
}

export function createNewgen(id: string, nationCode: string, position: Position, youthRating: number, year: number): Player {
  const { currentAbility, potentialAbility } = generateNewgenAbility(youthRating, NEWGEN_AGE, false);
  const potential = abilityToRating(potentialAbility);
  const overall = Math.min(abilityToRating(currentAbility), potential);
  const name = generatePlayerName(nationCode);

  return {
    id,
    firstName: name.firstName,
    lastName: name.lastName,
    commonName: null,
    primaryNationality: name.primaryNationality,
    secondaryNationality: name.secondaryNationality,
    age: NEWGEN_AGE,
    overall,
    potential,
    position,
    playerType: null,
    peakRange: null,
    progression: [createSeasonRow(year, NEWGEN_AGE, overall, potential)],
    caps: 0,
    u20Caps: 0,
    isShortlisted: false,
    retirementYear: null,
    isRetired: false
  };
}

/** The season's newgen intake for one nation. */
export function generateNationNewgens(
  nationCode: string,
  youthRating: number,
  year: number,
  allocateId: () => string
): Player[] {
  const positions = pickNewgenPositions();
  if (positions.length !== NEWGENS_PER_NATION) throw new Error("A newgen intake must contain 11 players.");
  return positions.map(position => createNewgen(allocateId(), nationCode, position, youthRating, year));
}

/**
 * Turns a few members of a season's newgen intake into wonderkids: potential 92-95 and an overall of
 * 60-70% of it. Only newgens whose potential is not already above 90 can be picked.
 */
export function applyWonderkids(intake: Player[]): Player[] {
  const eligible = intake.filter(player => player.potential <= WONDERKID_ELIGIBILITY_CEILING);
  const chosen = shuffledCopy(eligible).slice(0, WONDERKIDS_PER_SEASON);
  for (const player of chosen) {
    player.potential = randInt(WONDERKID_POTENTIAL_MIN, WONDERKID_POTENTIAL_MAX);
    player.overall = Math.round(player.potential * uniform(WONDERKID_OVERALL_SHARE_MIN, WONDERKID_OVERALL_SHARE_MAX));
    const season = player.progression[0];
    season.potential = player.potential;
    season.overall = player.overall;
  }
  return chosen;
}
