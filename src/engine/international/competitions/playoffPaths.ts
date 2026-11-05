import type { Bracket } from "../../shared/bracketTypes";
import { createKnockoutBracket } from "../../shared/scheduler";

export interface InternationalPlayoffPath {
  teams: string[];
  bracket: Bracket<string>;
}

export interface InternationalPlayoffPathDraw {
  pots: string[][];
  paths: InternationalPlayoffPath[];
}

/**
 * Ranks teams into pots, then distributes one team from each pot into each knockout path.
 * Bottom seeds are always ranked below regular seeds, while retaining their world-rank order.
 */
export function createInternationalPlayoffPaths(
  teams: string[],
  pathCount: number,
  worldRanks: Record<string, number>,
  bottomSeeds: string[] = []
): InternationalPlayoffPathDraw {
  if (!Number.isInteger(pathCount) || pathCount < 1) {
    throw new Error("International playoff path count must be a positive integer.");
  }
  if (teams.length < pathCount * 2) {
    throw new Error(`International playoff paths require at least two teams per path; received ${teams.length} teams for ${pathCount} paths.`);
  }
  if (new Set(teams).size !== teams.length) {
    throw new Error("International playoff teams must be unique.");
  }
  const teamSet = new Set(teams);
  if (new Set(bottomSeeds).size !== bottomSeeds.length || bottomSeeds.some(team => !teamSet.has(team))) {
    throw new Error("Bottom seeds must be unique teams included in the playoff draw.");
  }

  const bottomSeedSet = new Set(bottomSeeds);
  const byWorldRank = (a: string, b: string) =>
    (worldRanks[a] ?? Number.MAX_SAFE_INTEGER) - (worldRanks[b] ?? Number.MAX_SAFE_INTEGER) ||
    a.localeCompare(b);
  const rankedTeams = [
    ...teams.filter(team => !bottomSeedSet.has(team)).sort(byWorldRank),
    ...[...bottomSeeds].sort(byWorldRank)
  ];
  const pots = Array.from({ length: Math.ceil(teams.length / pathCount) }, (_, index) =>
    rankedTeams.slice(index * pathCount, (index + 1) * pathCount)
  );
  const targetSizes = Array.from({ length: pathCount }, (_, index) =>
    Math.floor(teams.length / pathCount) + (index < teams.length % pathCount ? 1 : 0)
  );
  const paths = Array.from({ length: pathCount }, () => [] as string[]);

  for (const pot of pots) {
    const availablePaths = paths
      .map((path, index) => ({ path, index }))
      .filter(({ path, index }) => path.length < targetSizes[index])
      .sort((a, b) => a.path.length - b.path.length || a.index - b.index);
    if (pot.length > availablePaths.length) {
      throw new Error("International playoff draw could not distribute a pot across available paths.");
    }
    pot.forEach((team, index) => availablePaths[index].path.push(team));
  }

  return {
    pots,
    paths: paths.map(pathTeams => ({
      teams: pathTeams,
      bracket: createKnockoutBracket(pathTeams)
    }))
  };
}

