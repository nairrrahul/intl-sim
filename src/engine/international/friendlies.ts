import { gaussian } from "../shared/random";
import type { InternationalRound, InternationalState } from "./types";

/** Friendly sets played in every window. */
export const FRIENDLY_SETS_PER_WINDOW = 2;

/** Standard deviation of the noise added to overalls when pairing, keeping opponents similar but varied. */
const PAIRING_NOISE = 2.5;

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Removes rematches (pairs in `avoid`) by swapping partners with the closest-rated other pair,
 * so opponents stay similar in overall.
 */
function repairRematches(pairs: [string, string][], avoid: Set<string>, overalls: Record<string, number>): void {
  const mid = (pair: [string, string]) => (overalls[pair[0]] + overalls[pair[1]]) / 2;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let i = 0; i < pairs.length; i++) {
      if (!avoid.has(pairKey(pairs[i][0], pairs[i][1]))) continue;
      const [a, b] = pairs[i];
      const others = pairs
        .map((pair, index) => ({ pair, index }))
        .filter(item => item.index !== i)
        .sort((x, y) => Math.abs(mid(x.pair) - mid(pairs[i])) - Math.abs(mid(y.pair) - mid(pairs[i])));
      for (const { pair: [c, d], index } of others) {
        const options: [[string, string], [string, string]][] = [[[a, c], [b, d]], [[a, d], [b, c]]];
        const ok = options.find(([p1, p2]) =>
          !avoid.has(pairKey(p1[0], p1[1])) && !avoid.has(pairKey(p2[0], p2[1])));
        if (ok) {
          pairs[i] = ok[0];
          pairs[index] = ok[1];
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }
}

/**
 * One set of friendlies: nations are paired with similar-overall opponents (a little noise keeps
 * pairings varied). With an odd number of nations one is left out, never the nation that was left
 * out of the previous set. Rematches of pairs in `avoid` are avoided where possible.
 */
export function scheduleFriendlies(
  state: InternationalState,
  overalls: Record<string, number>,
  avoid: Set<string>,
  eligibleCodes: string[]
): InternationalRound {
  let leftOut: string | null = null;
  let pool = eligibleCodes;

  if (eligibleCodes.length % 2 === 1) {
    const candidates = eligibleCodes.filter(code => code !== state.lastLeftOut);
    leftOut = candidates[Math.floor(Math.random() * candidates.length)];
    pool = eligibleCodes.filter(code => code !== leftOut);
  }

  let best: [string, string][] = [];
  let bestConflicts = Infinity;
  for (let attempt = 0; attempt < 40 && bestConflicts > 0; attempt++) {
    const ordered = pool
      .map(code => ({ code, key: overalls[code] + gaussian() * PAIRING_NOISE }))
      .sort((a, b) => b.key - a.key)
      .map(item => item.code);
    const pairs: [string, string][] = [];
    let conflicts = 0;
    for (let i = 0; i + 1 < ordered.length; i += 2) {
      const pair: [string, string] = Math.random() < 0.5 ? [ordered[i], ordered[i + 1]] : [ordered[i + 1], ordered[i]];
      if (avoid.has(pairKey(pair[0], pair[1]))) conflicts++;
      pairs.push(pair);
    }
    if (conflicts < bestConflicts) {
      best = pairs;
      bestConflicts = conflicts;
    }
  }

  repairRematches(best, avoid, overalls);

  state.lastLeftOut = leftOut;
  return {
    kind: "friendly",
    leftOut,
    matches: best.map(([home, away]) => ({
      home, away, kind: "friendly", homeGoals: null, awayGoals: null, homeChange: null, awayChange: null
    }))
  };
}
