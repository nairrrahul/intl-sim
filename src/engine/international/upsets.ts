import { getNationName } from "../nations/nations";
import type {
  InternationalMatch,
  MatchUpsetRecord,
  UpsetHistory,
  WindowRecord,
  InternationalState,
  TournamentUpsetRecord
} from "./types";

import {
  COMPETITIONS,
  type CupEditionLike
} from "./editionInsights";

export function createUpsetHistory(): UpsetHistory {
  return {
    ranking: [],
    rating: [],
    tournamentWinners: [],
    tournamentPlacings: []
  };
}

function alphabetical(a: MatchUpsetRecord, b: MatchUpsetRecord): number {
  return (
    getNationName(a.loser).localeCompare(getNationName(b.loser)) ||
    getNationName(a.winner).localeCompare(getNationName(b.winner))
  );
}

function sortRankingUpsets(
  records: MatchUpsetRecord[]
): MatchUpsetRecord[] {
  return [...records]
    .sort((a, b) =>
      b.rankingDifference - a.rankingDifference ||
      b.rankingUnderdogRank - a.rankingUnderdogRank ||
      alphabetical(a, b)
    )
    .slice(0, 20);
}

function sortRatingUpsets(
  records: MatchUpsetRecord[]
): MatchUpsetRecord[] {
  return [...records]
    .sort((a, b) =>
      b.ratingDifference - a.ratingDifference ||
      a.ratingUnderdogOverall - b.ratingUnderdogOverall ||
      alphabetical(a, b)
    )
    .slice(0, 20);
}

/**
 * Creates an upset record for a completed senior match.
 * Draws and U20 matches are excluded.
 */

function createRecord(
  match: InternationalMatch,
  window: WindowRecord,
  matchday: number
): MatchUpsetRecord | null {
  // Exclude all U20 matches and unfinished matches.
  if (
    match.kind.startsWith("u20") ||
    match.homeGoals === null ||
    match.awayGoals === null
  ) {
    return null;
  }

  // Draws are not upsets.
  if (match.homeGoals === match.awayGoals) {
    return null;
  }

  // These values must have been captured immediately before the match.
  const homeRank = match.homeRankBefore;
  const awayRank = match.awayRankBefore;
  const homeOverall = match.homeOverallBefore;
  const awayOverall = match.awayOverallBefore;

  if (
    homeRank === undefined ||
    awayRank === undefined ||
    homeOverall === undefined ||
    awayOverall === undefined
  ) {
    return null;
  }

  const homeWon = match.homeGoals > match.awayGoals;

  const winner = homeWon ? match.home : match.away;
  const loser = homeWon ? match.away : match.home;

  const winnerRank = homeWon ? homeRank : awayRank;
  const loserRank = homeWon ? awayRank : homeRank;

  const winnerOverall = homeWon ? homeOverall : awayOverall;
  const loserOverall = homeWon ? awayOverall : homeOverall;

  const rankingUpset = winnerRank > loserRank;
  const ratingUpset = winnerOverall < loserOverall;

  // A match must qualify for at least one of the two leaderboards.
  if (!rankingUpset && !ratingUpset) {
    return null;
  }

  return {
    year: window.year,
    windowId: window.windowId,
    matchday,

    home: match.home,
    away: match.away,
    winner,
    loser,

    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,

    homeRank,
    awayRank,
    homeOverall,
    awayOverall,

    rankingDifference: Math.abs(homeRank - awayRank),
    rankingUnderdogRank: Math.max(homeRank, awayRank),

    ratingDifference: Math.abs(homeOverall - awayOverall),
    ratingUnderdogOverall: Math.min(homeOverall, awayOverall)
  };
}


/** Updates the persisted top-20 upset lists after a completed matchday. */
export function updateUpsetHistory(
  history: UpsetHistory,
  matches: InternationalMatch[],
  window: WindowRecord,
  matchday: number
): void {
  const records = matches
    .map(match => createRecord(match, window, matchday))
    .filter((record): record is MatchUpsetRecord => record !== null);

  history.ranking = sortRankingUpsets([
    ...history.ranking,
    ...records.filter(record => {
      const winnerRank = record.winner === record.home
        ? record.homeRank
        : record.awayRank;

      const loserRank = record.loser === record.home
        ? record.homeRank
        : record.awayRank;

      return winnerRank > loserRank;
    })
  ]);

  history.rating = sortRatingUpsets([
    ...history.rating,
    ...records.filter(record => {
      const winnerOverall = record.winner === record.home
        ? record.homeOverall
        : record.awayOverall;

      const loserOverall = record.loser === record.home
        ? record.homeOverall
        : record.awayOverall;

      return winnerOverall < loserOverall;
    })
  ]);
}


function flattenTournamentRanking(
  tiers: { label: string; teams: string[] }[]
): Map<string, { position: number; stage: string }> {
  const placements = new Map<string, { position: number; stage: string }>();
  let position = 1;

  for (const tier of tiers) {
    for (const code of tier.teams) {
      placements.set(code, {
        position: position++,
        stage: tier.label
      });
    }
  }

  return placements;
}

function getTournamentPlacements(
  competition: string,
  edition: CupEditionLike
): TournamentUpsetRecord[] {
  if (
    !edition.completed ||
    !edition.predictedRanking ||
    !edition.actualRanking
  ) {
    return [];
  }

  const expected = flattenTournamentRanking(edition.predictedRanking);
  const actual = flattenTournamentRanking(edition.actualRanking);

  return edition.teams.flatMap(code => {
    const expectedPlacement = expected.get(code);
    const actualPlacement = actual.get(code);

    if (!expectedPlacement || !actualPlacement) {
      return [];
    }

    return [{
      code,
      competition,
      year: edition.year,
      expected: expectedPlacement.position,
      actual: actualPlacement.position,
      expectedStage: expectedPlacement.stage,
      actualStage: actualPlacement.stage,
      delta: expectedPlacement.position - actualPlacement.position,
      worldRank: edition.seedRanks[code] ?? Number.MAX_SAFE_INTEGER
    }];
  });
}

/**
 * Refreshes tournament upset leaderboards after a matchday.
 * Only frozen predictions and completed tournament results are used.
 */
export function updateTournamentUpsetHistory(
  history: UpsetHistory,
  state: InternationalState
): void {
  const placements: TournamentUpsetRecord[] = [];

  for (const info of Object.values(COMPETITIONS)) {
    if (info.youth) continue;

    for (const edition of info.editions(state)) {
      placements.push(
        ...getTournamentPlacements(info.name, edition)
      );
    }
  }

  const alphabetical = (
    a: TournamentUpsetRecord,
    b: TournamentUpsetRecord
  ) => getNationName(a.code).localeCompare(getNationName(b.code));

  history.tournamentWinners = placements
    .filter(record => record.actual === 1)
    .sort((a, b) =>
      b.delta - a.delta ||
      a.worldRank - b.worldRank ||
      alphabetical(a, b)
    )
    .slice(0, 20);

  history.tournamentPlacings = [...placements]
    .filter(record => record.expectedStage !== record.actualStage)
    .sort((a, b) =>
      Math.abs(b.delta) - Math.abs(a.delta) ||
      a.worldRank - b.worldRank ||
      alphabetical(a, b)
    )
    .slice(0, 20);
}
