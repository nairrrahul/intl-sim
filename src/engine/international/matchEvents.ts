import { POSITION_GROUP } from "../players/positions";
import { pickRandom, shuffledCopy, weightedPick } from "../shared/random";
import type { Player, Position } from "../players/types";
import type { GoalEvent, MatchSide, SubstitutionEvent } from "./types";

/** The players a nation brought to a match: the starting XI and the substitutes' bench. */
export interface MatchSquad {
  starters: Player[];
  bench: Player[];
}

export interface MatchDetails {
  goals: GoalEvent[];
  /** Substitutions that brought on a goalscorer or an assister (the only ones worth showing). */
  substitutions: SubstitutionEvent[];
  /** Everyone who played: the starters plus every substitute who came on. */
  appearances: Record<MatchSide, Player[]>;
  /** The goalkeeper credited with a clean sheet, per side. */
  cleanSheets: Record<MatchSide, Player | null>;
}

const MATCH_MINUTES = 90;
const EXTRA_TIME_MATCH_MINUTES = 120;
const FIRST_SUBSTITUTION_MINUTE = 46;
const LAST_SUBSTITUTION_MINUTE = 88;

/** How many substitutions a side makes (weighted). */
const SUBSTITUTION_COUNTS: [number, number][] = [[3, 25], [4, 30], [5, 45]];

/** Chance a goal is a penalty (penalties have no assister). */
const PENALTY_CHANCE = 0.1;

/** Substitutes are less likely to be the one involved in a goal than a starter in the same position. */
const SUBSTITUTE_FACTOR = 0.75;

/** Relative chance a player in each position scores a given goal. */
const SCORING_WEIGHT: Record<Position, number> = {
  ST: 10, RW: 6, LW: 6, CAM: 5, RM: 4, LM: 4, CM: 3, CDM: 1.5, CB: 1.5, RB: 1.2, LB: 1.2, GK: 0
};

/** Relative chance a player in each position assists a given goal. */
const ASSIST_WEIGHT: Record<Position, number> = {
  RW: 8, LW: 8, CAM: 8, RM: 6, LM: 6, CM: 6, ST: 4, RB: 4, LB: 4, CDM: 3, CB: 1.5, GK: 0.02
};

interface PlannedSubstitution {
  minute: number;
  off: Player;
  on: Player;
}

/**
 * Plans a side's substitutions. Goalkeepers are never substituted; a player comes off at most once
 * and a substitute goes on at most once. Replacements prefer the same position group.
 */
function planSubstitutions(squad: MatchSquad): PlannedSubstitution[] {
  const count = weightedPick(SUBSTITUTION_COUNTS.map(([value, weight]) => [value, weight] as [number, number])) ?? 3;
  const availableOff = squad.starters.filter(player => player.position !== "GK");
  const availableOn = squad.bench.filter(player => player.position !== "GK");
  const minutes = Array.from({ length: Math.min(count, availableOff.length, availableOn.length) }, () =>
    FIRST_SUBSTITUTION_MINUTE + Math.floor(Math.random() * (LAST_SUBSTITUTION_MINUTE - FIRST_SUBSTITUTION_MINUTE + 1))
  ).sort((a, b) => a - b);

  const plan: PlannedSubstitution[] = [];
  for (const minute of minutes) {
    const on = pickRandom(availableOn);
    availableOn.splice(availableOn.indexOf(on), 1);
    const off = weightedPick(availableOff.map(player =>
      [player, POSITION_GROUP[player.position] === POSITION_GROUP[on.position] ? 3 : 1] as [Player, number]
    )) ?? availableOff[0];
    availableOff.splice(availableOff.indexOf(off), 1);
    plan.push({ minute, off, on });
  }
  return plan;
}

// Helper to get a random number from an exponential distribution
function randomExponentialInt(): number {
  const ZERO_GOALS_FACTOR = 0.4;
  const lambda = -Math.log(ZERO_GOALS_FACTOR);
  const u = Math.random();

  return Math.floor(-Math.log(1 - u) / lambda);
}

function getExtraTimeGoals(goalDelta: number, count: number, randInt: number) : number {
  if(randInt == 0) {
    return randInt;
  } else {
    if(count % 2 == 0) {
      return Math.min(count, Math.max(goalDelta,randInt * 2));
    } else {
      return Math.min(count, Math.max(goalDelta,randInt % 2 == 0 ? randInt + 1 : randInt));
    }
  }
}

/**
 * Distinct goal minutes for the whole match (no two goals share a minute): the minutes 1-90 are
 * shuffled and the first `count` taken. (Beyond 90 goals, minutes necessarily repeat.)
 */
function pickGoalMinutes(homeGoals: number, awayGoals: number, isKnockout: boolean): {goalMinutes: number[], extraTimeGoals: number} {
  //if a knockout match, we need to know how many goals arrive after extra time, if any
  const count = homeGoals + awayGoals;
  const goalDelta = Math.abs(homeGoals - awayGoals);
  const randomExpValue = randomExponentialInt();
  const extraTimeGoalsCount = isKnockout ? getExtraTimeGoals(goalDelta, count, randomExpValue) : 0;
  const minutes = shuffledCopy(Array.from({ length: MATCH_MINUTES }, (_, index) => index + 1));
  const extraTimeMinutes = shuffledCopy(Array.from({ length: EXTRA_TIME_MATCH_MINUTES - MATCH_MINUTES }, (_, index) => index + 1 + MATCH_MINUTES));
  if(extraTimeGoalsCount === 0) {
    return { 
      goalMinutes: Array.from({ length: count }, (_, index) => minutes[index % MATCH_MINUTES]).sort((a, b) => a - b) ,
      extraTimeGoals: extraTimeGoalsCount
    };
  } else {
    const regTimeGoals = Array.from({ length: count - extraTimeGoalsCount}, (_, index) => minutes[index % MATCH_MINUTES]).sort((a, b) => a - b);
    const extraTimeGoals = Array.from({ length: extraTimeGoalsCount }, (_, index) => extraTimeMinutes[index % (EXTRA_TIME_MATCH_MINUTES - MATCH_MINUTES)]).sort((a, b) => a - b);
    return {
      goalMinutes: Array.from([...regTimeGoals, ...extraTimeGoals]).sort((a,b) => a-b),
      extraTimeGoals: extraTimeGoalsCount
    };
  }
  
}

/**
 * Whether `player` is on the pitch at `minute`: a starter until the minute they are replaced, a
 * substitute only after the minute they come on. (A substitution always happens strictly before any
 * goal its substitute is credited with, and a replaced player never scores after leaving.)
 */
function isOnPitch(player: Player, minute: number, squad: MatchSquad, plan: PlannedSubstitution[]): boolean {
  if (squad.starters.includes(player)) {
    const replacedAt = plan.find(substitution => substitution.off === player)?.minute;
    return replacedAt === undefined || minute < replacedAt;
  }
  const cameOnAt = plan.find(substitution => substitution.on === player)?.minute;
  return cameOnAt !== undefined && minute > cameOnAt;
}

function pickInvolved(
  candidates: Player[],
  weights: Record<Position, number>,
  squad: MatchSquad
): Player | null {
  return weightedPick(candidates.map(player => {
    const substituteFactor = squad.starters.includes(player) ? 1 : SUBSTITUTE_FACTOR;
    return [player, weights[player.position] * substituteFactor] as [Player, number];
  }));
}

interface SideDraft {
  squad: MatchSquad;
  plan: PlannedSubstitution[];
}

/**
 * Works out the story of a played match: when each goal was scored, by whom and who assisted, which
 * substitutions mattered, who played and who kept a clean sheet. Scorers and assisters are always
 * players who are on the pitch at that minute.
 */
export function generateMatchDetails(
  homeGoals: number,
  awayGoals: number,
  home: MatchSquad,
  away: MatchSquad,
  isKnockout: boolean
): MatchDetails {
  const sides: Record<MatchSide, SideDraft> = {
    home: { squad: home, plan: planSubstitutions(home) },
    away: { squad: away, plan: planSubstitutions(away) }
  };

  // Each minute goes to one side: a shuffled list of sides (home x homeGoals, away x awayGoals) is paired with the minutes.
  const {goalMinutes, extraTimeGoals} = pickGoalMinutes(homeGoals, awayGoals, isKnockout);
  const homeExtraTimeGoals = Math.max(0,Math.floor((extraTimeGoals + homeGoals - awayGoals)/2));
  const awayExtraTimeGoals = Math.max(0,Math.floor((extraTimeGoals - homeGoals + awayGoals)/2));

  const preExtraTimeGoals = [
    ...Array<MatchSide>(homeGoals - homeExtraTimeGoals).fill("home"),
    ...Array<MatchSide>(awayGoals - awayExtraTimeGoals).fill("away")
  ]
  
  const postExtraTimeGoals = [
    ...Array<MatchSide>(homeExtraTimeGoals).fill("home"),
    ...Array<MatchSide>(awayExtraTimeGoals).fill("away")
  ]

  const goalSides = [...shuffledCopy(preExtraTimeGoals), ...shuffledCopy(postExtraTimeGoals)];

  const goals: GoalEvent[] = [];
  goalSides.forEach((side, index) => {
    const minute = goalMinutes[index];
    const { squad, plan } = sides[side];
    const onPitch = [...squad.starters, ...squad.bench].filter(player => isOnPitch(player, minute, squad, plan));
    const outfield = onPitch.filter(player => player.position !== "GK");

    if (Math.random() < PENALTY_CHANCE && outfield.length > 0) {
      // Penalties are scored by the best outfield player on the pitch and are never assisted.
      const taker = outfield.reduce((best, player) => (player.overall > best.overall ? player : best));
      goals.push({ minute, side, scorerId: taker.id, assistId: null, penalty: true });
      return;
    }
    const scorer = pickInvolved(onPitch, SCORING_WEIGHT, squad) ?? outfield[0] ?? onPitch[0];
    if (!scorer) return;
    const assister = pickInvolved(onPitch.filter(player => player !== scorer), ASSIST_WEIGHT, squad);
    goals.push({ minute, side, scorerId: scorer.id, assistId: assister?.id ?? null });
  });
  goals.sort((a, b) => a.minute - b.minute || (a.side === b.side ? 0 : a.side === "home" ? -1 : 1));

  const involvedIds = new Set(goals.flatMap(goal => [goal.scorerId, goal.assistId]));
  const substitutions: SubstitutionEvent[] = [];
  for (const side of ["home", "away"] as MatchSide[]) {
    for (const substitution of sides[side].plan) {
      if (involvedIds.has(substitution.on.id)) {
        substitutions.push({ minute: substitution.minute, side, offId: substitution.off.id, onId: substitution.on.id });
      }
    }
  }
  substitutions.sort((a, b) => a.minute - b.minute);

  const appearancesOf = (side: MatchSide) => [
    ...sides[side].squad.starters,
    ...sides[side].plan.map(substitution => substitution.on)
  ];
  const goalkeeperOf = (side: MatchSide) => sides[side].squad.starters.find(player => player.position === "GK") ?? null;

  return {
    goals,
    substitutions,
    appearances: { home: appearancesOf("home"), away: appearancesOf("away") },
    cleanSheets: {
      home: awayGoals === 0 ? goalkeeperOf("home") : null,
      away: homeGoals === 0 ? goalkeeperOf("away") : null
    }
  };
}
