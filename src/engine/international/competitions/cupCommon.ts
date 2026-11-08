import { shuffledCopy } from "../../shared/random";
import hostGroupAllocationRaw from "../data/host_group_allocation.json";
import type { InternationalMatch, InternationalRound, PredictedTier, StatLeaders } from "../types";

export type InternationalCup = "goldCup" | "copaAmerica" | "confedCup" | "u20WorldCup" | "afcon" | "afcCup" | "ofcCup" | "euro";
/** Cups whose knockout fixtures are built with makeKnockoutMatch. */
export type KnockoutFixtureCup = "goldCup" | "copaAmerica" | "confedCup";

/** Cups that play a third-place match alongside the final. */
const THIRD_PLACE_CUPS: readonly InternationalCup[] = ["goldCup", "confedCup"];

export const THIRD_PLACE_MATCH_ID = "3P";

/** The losing sides of a played knockout round, in match order. */
export function getKnockoutLosers(matches: { home: string; away: string; winner: string | null }[]): string[] {
  return matches.map(match => {
    if (!match.winner) throw new Error("Cannot find the losers of an unfinished knockout round.");
    return match.winner === match.home ? match.away : match.home;
  });
}

const GROUP_PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [3, 1]],
  [[0, 3], [1, 2]]
];

const EDITION_PREFIXES: Record<InternationalCup, string> = {
  goldCup: "GC", copaAmerica: "COPA", confedCup: "CC", u20WorldCup: "U20WC", afcon: "AFCON", afcCup: "AFC", ofcCup: "OFC", euro: "EURO"
};

export const CUP_LABELS: Record<KnockoutFixtureCup, string> = {
  goldCup: "Gold Cup", copaAmerica: "Copa América", confedCup: "Confederations Cup"
};

export interface InternationalCompetitionGroup {
  name: string;
  teams: string[];
  matches: InternationalMatch[][];
}

export interface InternationalCompetitionKnockoutMatch {
  id: string;
  home: string;
  away: string;
  fixture: InternationalMatch;
  winner: string | null;
}

export interface InternationalCompetitionKnockoutRound {
  label: "Round of 32" | "Round of 16" | "Quarter-finals" | "Semi-finals" | "Final";
  matches: InternationalCompetitionKnockoutMatch[];
}

export interface InternationalCompetitionEdition {
  id: string;
  year: number;
  suffix?: "1" | "2";
  windowId: string;
  hosts: string[];
  teams: string[];
  pots: string[][];
  seedRanks: Record<string, number>;
  groups: InternationalCompetitionGroup[];
  knockout: InternationalCompetitionKnockoutRound[] | null;
  completed: boolean;
  winner: string | null;
  runnerUp: string | null;
  semifinalists: string[];
  /** Winner of the third-place match (cups that play one). */
  thirdPlace?: string | null;
  /** Set once the winner's players have been given the trophy. */
  trophyAwarded?: boolean;
  /** Frozen at completion: predicted and actual rankings, plus the top-10 stat leaders. */
  predictedRanking?: PredictedTier[];
  actualRanking?: PredictedTier[];
  statLeaders?: StatLeaders;
  youthRatingImpactApplied?: boolean;
  playoffTeams?: string[];
}

export function createMatch(
  home: string,
  away: string,
  kind: InternationalMatch["kind"],
  year: number,
  windowId: string,
  extra: Partial<InternationalMatch>
): InternationalMatch {
  return {
    home,
    away,
    kind,
    homeGoals: null,
    awayGoals: null,
    homeChange: null,
    awayChange: null,
    windowYear: year,
    windowId,
    ...extra
  };
}

export function drawInternationalCupGroups(
  teams: string[],
  hosts: string[],
  worldRanks: Record<string, number>,
  groupNames: string[] = ["A", "B", "C", "D"]
): { pots: string[][]; groups: string[][] } {
  if (groupNames.length === 0 || teams.length % groupNames.length !== 0) {
    throw new Error("International cup teams must divide evenly among the groups.");
  }
  const teamsPerGroup = teams.length / groupNames.length;
  if (hosts.length > groupNames.length || new Set(hosts).size !== hosts.length ||
      hosts.some(host => !teams.includes(host))) {
    throw new Error("International cup hosts must be unique teams in the tournament field and fit in Pot 1.");
  }
  const hostSet = new Set(hosts);
  const ranked = [...teams].sort((a, b) =>
    (worldRanks[a] ?? Number.MAX_SAFE_INTEGER) - (worldRanks[b] ?? Number.MAX_SAFE_INTEGER) ||
    a.localeCompare(b)
  );
  const potOne = [
    ...ranked.filter(code => hostSet.has(code)),
    ...ranked.filter(code => !hostSet.has(code)).slice(0, groupNames.length - hosts.length)
  ];
  const remaining = ranked.filter(code => !potOne.includes(code));
  const pots = [
    potOne,
    ...Array.from({ length: teamsPerGroup - 1 }, (_, index) =>
      remaining.slice(index * groupNames.length, (index + 1) * groupNames.length))
  ];
  const groups = groupNames.map(() => [] as string[]);
  const hostGroupIndexes = assignHostsToGroups(groups, groupNames, hosts);
  const firstPotTeams = shuffledCopy(pots[0].filter(team => !hostSet.has(team)));
  const nonHostGroupIndexes = groups.map((_, index) => index).filter(index => !hostGroupIndexes.has(index));
  if (firstPotTeams.length !== nonHostGroupIndexes.length) {
    throw new Error("International cup Pot 1 does not match the available host-group slots.");
  }
  firstPotTeams.forEach((team, index) => groups[nonHostGroupIndexes[index]].push(team));
  for (const pot of pots.slice(1)) {
    shuffledCopy(pot).forEach((team, index) => groups[index].push(team));
  }
  return { pots, groups };
}

const hostGroupAllocations = hostGroupAllocationRaw as Record<string, Record<string, string[]>>;

export function assignHostsToGroups(
  groups: string[][],
  groupNames: string[],
  hosts: string[]
): Set<number> {
  if (hosts.length === 0) return new Set();
  const allocations = hostGroupAllocations[String(hosts.length)];
  if (!allocations) {
    throw new Error(`Host-group allocation is missing for ${hosts.length} hosts.`);
  }
  const configuredGroups = allocations[String(groupNames.length)] ?? allocations.Z;
  if (!configuredGroups || configuredGroups.length !== hosts.length ||
      new Set(configuredGroups).size !== hosts.length ||
      configuredGroups.some(name => !groupNames.includes(name))) {
    throw new Error(`Host-group allocation is invalid for ${hosts.length} hosts and ${groupNames.length} groups.`);
  }
  const hostGroupIndexes = new Set<number>();
  shuffledCopy(hosts).forEach((host, index) => {
    const groupIndex = groupNames.indexOf(configuredGroups[index]);
    if (groupIndex < 0 || !groups[groupIndex]) {
      throw new Error(`Could not assign host "${host}" to Group ${configuredGroups[index]}.`);
    }
    groups[groupIndex].push(host);
    hostGroupIndexes.add(groupIndex);
  });
  return hostGroupIndexes;
}

export function createInternationalCupGroupMatches(
  teams: string[],
  group: string,
  year: number,
  windowId: string,
  competition: InternationalCup = "goldCup",
  competitionEditionId?: string
): InternationalMatch[][] {
  const editionId = competitionEditionId ?? `${EDITION_PREFIXES[competition]}-${year}-${windowId}`;
  return GROUP_PAIRINGS.map((pairing, roundIndex) =>
    pairing.map(([homeIndex, awayIndex]) =>
      // Every cup stores its fields under the same keys, prefixed with the competition name.
      createMatch(teams[homeIndex], teams[awayIndex], `${competition}Group`, year, windowId, {
        [`${competition}EditionId`]: editionId,
        [`${competition}Stage`]: "group",
        [`${competition}Group`]: group,
        [`${competition}Round`]: roundIndex + 1
      } as Partial<InternationalMatch>)
    )
  );
}

export function getInternationalCupStandings(
  edition: Pick<InternationalCompetitionEdition, "seedRanks">,
  group: InternationalCompetitionGroup
) {
  const rows = new Map(group.teams.map(code => [code, {
    code, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0
  }]));
  for (const match of group.matches.flat()) {
    if (match.homeGoals === null || match.awayGoals === null) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) throw new Error(`Invalid fixture in international Group ${group.name}.`);
    home.played++;
    away.played++;
    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;
    if (match.homeGoals > match.awayGoals) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (match.homeGoals < match.awayGoals) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  return [...rows.values()].map(row => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst
  })).sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    (edition.seedRanks[a.code] ?? Number.MAX_SAFE_INTEGER) -
      (edition.seedRanks[b.code] ?? Number.MAX_SAFE_INTEGER)
  );
}

export function makeKnockoutMatch(
  edition: InternationalCompetitionEdition,
  id: string,
  home: string,
  away: string,
  competition: KnockoutFixtureCup
): InternationalCompetitionKnockoutMatch {
  const fixture = createMatch(home, away, `${competition}Knockout`, edition.year, edition.windowId, {
    [`${competition}EditionId`]: edition.id,
    [`${competition}Stage`]: "knockout",
    [`${competition}KnockoutMatchId`]: id
  } as Partial<InternationalMatch>);
  return { id, home, away, fixture, winner: null };
}

export function advanceInternationalCupRound(
  edition: InternationalCompetitionEdition,
  roundIndex: number,
  competition: KnockoutFixtureCup = "goldCup"
): InternationalRound | null {
  const competitionLabel = CUP_LABELS[competition];
  if (roundIndex === -1) {
    if (edition.groups.some(group => group.matches.flat().some(match => match.homeGoals === null || match.awayGoals === null))) {
      return null;
    }
    const topTwo = Object.fromEntries(edition.groups.map(group => [
      group.name,
      getInternationalCupStandings(edition, group).slice(0, 2).map(row => row.code)
    ])) as Record<"A" | "B" | "C" | "D", string[]>;
    const quarterFinals = [
      ["A", 0, "B", 1],
      ["C", 0, "D", 1],
      ["B", 0, "A", 1],
      ["D", 0, "C", 1]
    ] as const;
    const matches = quarterFinals.map(([group1, place1, group2, place2], index) =>
      makeKnockoutMatch(edition, `QF${index + 1}`, topTwo[group1][place1], topTwo[group2][place2], competition)
    );
    edition.knockout = [{ label: "Quarter-finals", matches }];
    return { kind: competition, label: `${competitionLabel} · Quarter-finals`, leftOut: null, matches: matches.map(match => match.fixture) };
  }

  const knockout = edition.knockout;
  const round = knockout?.[roundIndex];
  if (!round || round.matches.some(match => match.winner === null)) return null;
  if (roundIndex === 0 || roundIndex === 1) {
    const winners = round.matches.map(match => match.winner as string);
    const nextMatches = Array.from({ length: roundIndex === 0 ? 2 : 1 }, (_, index) =>
      makeKnockoutMatch(edition, roundIndex === 0 ? `SF${index + 1}` : "F",
        winners[index * 2], winners[index * 2 + 1], competition)
    );
    const label = roundIndex === 0 ? "Semi-finals" : "Final";
    if (roundIndex === 1 && THIRD_PLACE_CUPS.includes(competition)) {
      const [first, second] = getKnockoutLosers(round.matches);
      nextMatches.push(makeKnockoutMatch(edition, THIRD_PLACE_MATCH_ID, first, second, competition));
    }
    knockout.push({ label, matches: nextMatches });
    if (roundIndex === 1) {
      edition.semifinalists = round.matches.map(match => {
        if (!match.winner) throw new Error(`${competitionLabel} semi-final "${match.id}" has no winner.`);
        return match.winner === match.home ? match.away : match.home;
      });
    }
    return { kind: competition, label: `${competitionLabel} · ${label}`, leftOut: null, matches: nextMatches.map(match => match.fixture) };
  }

  const final = round.matches[0];
  edition.winner = final.winner;
  edition.runnerUp = final.winner === final.home ? final.away : final.home;
  edition.thirdPlace = round.matches.find(match => match.id === THIRD_PLACE_MATCH_ID)?.winner ?? null;
  edition.completed = true;
  return null;
}

export function setInternationalCupKnockoutWinner(
  edition: InternationalCompetitionEdition,
  matchId: string,
  winner: string
): void {
  const match = edition.knockout?.flatMap(round => round.matches).find(item => item.id === matchId);
  if (!match) throw new Error(`Unknown cup knockout match "${matchId}".`);
  match.winner = winner;
}
