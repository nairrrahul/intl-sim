import type { InternationalRound, ScheduledRound, WindowRecord } from "./types";

/**
 * A lane is one competition strand inside a window (e.g. "friendly", "goldCup", or one World Cup
 * qualifying phase). Matchday N of a window plays the Nth round of every lane, so a window with
 * two friendly sets and a Copa América runs: MD1 = friendly 1 + group MD1, MD2 = friendly 2 +
 * group MD2, MD3 = group MD3, MD4 = quarter-finals, and so on.
 */
export function getLaneKey(round: InternationalRound): string {
  switch (round.kind) {
    case "worldCupQualifier": return `worldCupQualifier:${round.worldCupPhase ?? round.worldCupStage}`;
    case "afconQualifier": return `afconQualifier:${round.afconQualifierId}`;
    case "afcCupQualifier": return `afcCupQualifier:${round.afcCupQualifierId}`;
    case "ofcCupQualifier": return `ofcCupQualifier:${round.ofcCupQualifierId}`;
    case "euroQualifier": return `euroQualifier:${round.euroQualifierId}:${round.euroStage}`;
    default: return round.kind ?? "friendly";
  }
}

function lastMatchdayOfLane(window: WindowRecord, lane: string): number {
  return window.rounds
    .filter(round => round.lane === lane)
    .reduce((latest, round) => Math.max(latest, round.matchday), 0);
}

/** Appends a round to its lane, on the lane's next free matchday. */
export function addRoundToWindow(window: WindowRecord, round: InternationalRound): ScheduledRound {
  const lane = getLaneKey(round);
  const scheduled: ScheduledRound = { ...round, lane, matchday: lastMatchdayOfLane(window, lane) + 1 };
  window.rounds.push(scheduled);
  return scheduled;
}

/** Number of matchdays the window currently spans (grows as knockout rounds are drawn). */
export function getWindowMatchdayCount(window: WindowRecord): number {
  return window.rounds.reduce((latest, round) => Math.max(latest, round.matchday), 0);
}
