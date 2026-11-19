import type { World } from "../world/world";
import type { Player } from "./types";

export interface YearlyAwardRecord {
  year: number;
  playerId: string;
}

export interface YearlyAwards {
  finalizedYears: number[];
  goldenBoot: YearlyAwardRecord[];
  goldenGlove: YearlyAwardRecord[];
  youngTalent: YearlyAwardRecord[];
}

export function createYearlyAwards(): YearlyAwards {
  return {
    finalizedYears: [],
    goldenBoot: [],
    goldenGlove: [],
    youngTalent: []
  };
}

function playerName(player: Player): string {
  return player.commonName ||
    `${player.firstName} ${player.lastName}`;
}

function getYearlyNationRanks(world: World, year: number): Map<string, number> {
  const snapshots = world.international.rankingHistory
    .filter(snapshot => snapshot.year === year);

  const latest = snapshots.at(-1);
  const ranks = new Map<string, number>();

  latest?.ranks.forEach(([code], index) => {
    ranks.set(code, index + 1);
  });

  return ranks;
}

function finalizeYear(world: World, year: number): void {
  const awards = world.yearlyAwards;

  if (awards.finalizedYears.includes(year)) return;

  const ranks = getYearlyNationRanks(world, year);

  const candidates = world.players.flatMap(player => {
    const season = player.progression.find(row => row.year === year);
    if (!season) return [];

    return [{
      player,
      season,
      nationRating: world.international.nations[player.primaryNationality]?.overall ?? 0,
      nationRank: ranks.get(player.primaryNationality) ?? Number.MAX_SAFE_INTEGER
    }];
  });

  const alphabetical = (a: typeof candidates[number], b: typeof candidates[number]) =>
    playerName(a.player).localeCompare(playerName(b.player));

  // Golden Boot: goals, player overall, national ranking, alphabetical.
  const goldenBoot = [...candidates]
    .sort((a, b) =>
      b.season.goals - a.season.goals ||
      b.season.overall - a.season.overall ||
      a.nationRank - b.nationRank ||
      alphabetical(a, b)
    )[0];

  if (goldenBoot) {
    awards.goldenBoot.push({
      year,
      playerId: goldenBoot.player.id
    });
  }

  // Golden Glove: clean sheets, player overall, national ranking, alphabetical.
  const goldenGlove = candidates
    .filter(candidate => candidate.player.position === "GK")
    .sort((a, b) =>
      b.season.cleanSheets - a.season.cleanSheets ||
      b.season.overall - a.season.overall ||
      a.nationRank - b.nationRank ||
      alphabetical(a, b)
    )[0];

  if (goldenGlove) {
    awards.goldenGlove.push({
      year,
      playerId: goldenGlove.player.id
    });
  }

  // Young Talent: highest-rated eligible U20 player.
  // A previous winner cannot win this award again.
  const previousWinners = new Set(
    awards.youngTalent.map(record => record.playerId)
  );

  const youngTalent = candidates
    .filter(candidate =>
      candidate.season.age <= 20 &&
      !previousWinners.has(candidate.player.id)
    )
    .sort((a, b) =>
      b.season.overall - a.season.overall ||
      b.season.caps - a.season.caps ||
      b.season.u20Caps - a.season.u20Caps ||
      (b.season.goals + b.season.cleanSheets) -
        (a.season.goals + a.season.cleanSheets) ||
      b.nationRating - a.nationRating ||
      a.nationRank - b.nationRank ||
      alphabetical(a, b)
    )[0];

  if (youngTalent) {
    awards.youngTalent.push({
      year,
      playerId: youngTalent.player.id
    });
  }

  awards.finalizedYears.push(year);
}

/** Called once when the current season ends. */
export function finalizeYearlyAwards(world: World): void {
  if (!world.yearlyAwards) {
    world.yearlyAwards = createYearlyAwards();
  }

  finalizeYear(world, world.year);
}
