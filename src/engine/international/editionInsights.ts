import { advanceWorldCupKnockout, startWorldCupRoundOf32 } from "./competitions/worldcup/tournament";
import type { InternationalCompetitionEdition } from "./competitions/cupCommon";
import { getInternationalCupStandings } from "./competitions/cupCommon";
import type { WorldCupTournament } from "./competitions/worldcup/types";
import { computeRankings } from "./rankings";
import { TOURNAMENTS } from "./roundProgression";
import type { Player } from "../players/types";
import type {
  InternationalMatch, InternationalRound, InternationalState, MatchSide, PredictedTier, StatLeader, StatLeaders
} from "./types";

/**
 * Predictions and stat leaders for the cup tournaments (not qualifiers or the Nations League).
 * Predictions are frozen when the tournament is drawn; actual results and stats are frozen on completion.
 */
export type CompetitionKey =
  | "worldCup" | "euro" | "copaAmerica" | "goldCup" | "afcon" | "afcCup" | "ofcCup" | "confedCup" | "u20WorldCup";

/** What both cup edition shapes (a cup edition or a World Cup tournament) have in common. */
export interface CupEditionLike {
  teams: string[];
  seedRanks: Record<string, number>;
  groups: { name: string; teams: string[]; matches: InternationalMatch[][] }[];
  knockout: { label: string; matches: { id: string; home: string; away: string; fixture: InternationalMatch; winner: string | null }[] }[] | null;
  completed: boolean;
  winner: string | null;
  runnerUp: string | null;
  thirdPlace?: string | null;
  predictedRanking?: PredictedTier[];
  actualRanking?: PredictedTier[];
  statLeaders?: StatLeaders;
  youthRatingImpactApplied?: boolean;
}

interface CompetitionInfo {
  /** U20 tournaments are played by the nations' U20 teams. */
  youth: boolean;
  editions: (state: InternationalState) => CupEditionLike[];
}

export const COMPETITIONS: Record<CompetitionKey, CompetitionInfo> = {
  worldCup: { youth: false, editions: s => s.worldCup.editions.flatMap(edition => edition.tournament ? [edition.tournament as unknown as CupEditionLike] : []) },
  euro: { youth: false, editions: s => s.euro.editions },
  copaAmerica: { youth: false, editions: s => s.copaAmerica.editions },
  goldCup: { youth: false, editions: s => s.goldCup.editions },
  afcon: { youth: false, editions: s => s.afcon.editions },
  afcCup: { youth: false, editions: s => s.afcCup.editions },
  ofcCup: { youth: false, editions: s => s.ofcCup.editions },
  confedCup: { youth: false, editions: s => s.confedCup.editions },
  u20WorldCup: { youth: true, editions: s => s.u20WorldCup.editions }
};

/** Match kinds whose appearances and clean sheets are recorded, so competition stats can be built from them. */
const TRACKED_KINDS = /^(worldCup|euro|copaAmerica|goldCup|confedCup|u20WorldCup|afcon|afcCup|ofcCup)(Group|Knockout)$/;
export const isTrackedTournamentMatch = (match: InternationalMatch): boolean => TRACKED_KINDS.test(match.kind);

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export interface TeamStrength {
  overall: (code: string) => number;
  /** World ranking position (1 = best), used to break overall ties. */
  rank: (code: string) => number;
}

export function createTeamStrength(state: InternationalState, youth: boolean): TeamStrength {
  const ranks = new Map(computeRankings(state).map(row => [row.code, row.rank]));
  return {
    overall: code => (youth ? state.nations[code]?.u20.overall : state.nations[code]?.overall) ?? 0,
    rank: code => ranks.get(code) ?? Number.MAX_SAFE_INTEGER
  };
}

function advance(competition: CompetitionKey, edition: CupEditionLike): { afterGroup: () => InternationalRound | null; afterKnockout: (index: number) => InternationalRound | null } {
  if (competition === "worldCup") {
    const tournament = edition as unknown as WorldCupTournament;
    return {
      afterGroup: () => startWorldCupRoundOf32(tournament),
      afterKnockout: index => advanceWorldCupKnockout(tournament, index)
    };
  }
  const rules = TOURNAMENTS[competition];
  const cup = edition as unknown as InternationalCompetitionEdition;
  return { afterGroup: () => rules.afterGroup(cup), afterKnockout: index => rules.afterKnockout(cup, index) };
}

const TIER_LABELS: Record<string, string> = {
  "Round of 32": "Round of 32",
  "Round of 16": "Round of 16",
  "Quarter-finals": "Quarter-Finalists",
  "Semi-finals": "Semi-Finalists"
};

/**
 * Predicts a tournament's final ranking by simulating all of it from the draw with a deterministic rule:
 * the team with the higher overall wins every match (world ranking breaks ties). Teams are grouped in tiers
 * by the stage they reach and ranked by the same rule within each tier.
 */
export function predictRanking(competition: CompetitionKey, source: CupEditionLike, strength: TeamStrength): PredictedTier[] {
  const better = (a: string, b: string): number =>
    strength.overall(b) - strength.overall(a) || strength.rank(a) - strength.rank(b) || a.localeCompare(b);
  const stronger = (a: string, b: string): string => (better(a, b) <= 0 ? a : b);

  // Work on a copy so the real tournament is untouched; discard any real results and knockout.
  const edition = structuredClone(source) as CupEditionLike;
  edition.knockout = null;
  edition.completed = false;
  edition.winner = null;
  edition.runnerUp = null;
  edition.thirdPlace = null;
  edition.seedRanks = Object.fromEntries([...edition.teams].sort(better).map((code, index) => [code, index + 1]));

  const setResult = (fixture: InternationalMatch, winnerIsHome: boolean) => {
    fixture.homeGoals = winnerIsHome ? 1 : 0;
    fixture.awayGoals = winnerIsHome ? 0 : 1;
  };
  for (const group of edition.groups) {
    for (const fixture of group.matches.flat()) setResult(fixture, stronger(fixture.home, fixture.away) === fixture.home);
  }

  // The advance functions fill in edition.knockout, so read it through a function rather than a narrowed field.
  const knockoutRounds = (): NonNullable<CupEditionLike["knockout"]> => edition.knockout ?? [];
  const advancer = advance(competition, edition);
  advancer.afterGroup();
  for (let roundIndex = 0; roundIndex < knockoutRounds().length; roundIndex++) {
    for (const match of knockoutRounds()[roundIndex].matches) {
      match.winner = stronger(match.home, match.away);
      setResult(match.fixture, match.winner === match.home);
    }
    advancer.afterKnockout(roundIndex);
  }

  const rounds = knockoutRounds();
  const tiers: PredictedTier[] = [];
  const addTier = (label: string, teams: string[]) => {
    if (teams.length > 0) tiers.push({ label, teams: [...teams].sort(better) });
  };
  const losersOf = (round: NonNullable<CupEditionLike["knockout"]>[number]) =>
    round.matches.map(match => (match.winner === match.home ? match.away : match.home));

  const finalRound = rounds.at(-1);
  if (finalRound) {
    const final = finalRound.matches.find(match => match.id === "F") ?? finalRound.matches[0];
    const thirdPlaceMatch = finalRound.matches.find(match => match.id === "3P");
    addTier("Winner", [final.winner as string]);
    addTier("Runner-Up", losersOf({ label: "", matches: [final] }));
    if (thirdPlaceMatch) {
      addTier("Third Place", [thirdPlaceMatch.winner as string]);
      addTier("Fourth Place", losersOf({ label: "", matches: [thirdPlaceMatch] }));
    } else {
      const semiFinals = rounds.at(-2);
      if (semiFinals) addTier("Semi-Finalists", losersOf(semiFinals));
    }
    // The semi-final losers are already placed (third/fourth, or the Semi-Finalists tier), so continue from the quarter-finals.
    for (let index = rounds.length - 3; index >= 0; index--) {
      addTier(TIER_LABELS[rounds[index].label] ?? rounds[index].label, losersOf(rounds[index]));
    }
  }
  const inKnockout = new Set(rounds[0]?.matches.flatMap(match => [match.home, match.away]) ?? []);
  addTier("Group Stage", edition.teams.filter(code => !inKnockout.has(code)));
  return tiers;
}

/** Ranks a completed tournament by its final results, using group-stage performance to order teams tied by knockout stage. */
export function rankActualResults(source: CupEditionLike, strength: TeamStrength): PredictedTier[] {
  const ranks = Object.fromEntries(source.teams.map(code => [code, strength.rank(code)]));
  const groupStandings = source.groups.flatMap(group => getInternationalCupStandings({ seedRanks: ranks }, group));
  const groupByTeam = new Map(groupStandings.map(row => [row.code, row]));
  const knockoutOrder = (a: string, b: string): number =>
    (groupByTeam.get(b)?.points ?? 0) - (groupByTeam.get(a)?.points ?? 0) ||
    strength.rank(a) - strength.rank(b) ||
    a.localeCompare(b);
  const groupOrder = (a: string, b: string): number => {
    const first = groupByTeam.get(a);
    const second = groupByTeam.get(b);
    return (second?.points ?? 0) - (first?.points ?? 0) ||
      (second?.goalDifference ?? 0) - (first?.goalDifference ?? 0) ||
      (second?.goalsFor ?? 0) - (first?.goalsFor ?? 0) ||
      strength.rank(a) - strength.rank(b) ||
      a.localeCompare(b);
  };
  const rounds = source.knockout ?? [];
  const tiers: PredictedTier[] = [];
  const addTier = (label: string, teams: string[], compare: (a: string, b: string) => number) => {
    if (teams.length > 0) tiers.push({ label, teams: [...teams].sort(compare) });
  };
  const winnerOf = (match: NonNullable<CupEditionLike["knockout"]>[number]["matches"][number]): string => {
    if (!match.winner) throw new Error(`Completed tournament has no winner for knockout match "${match.id}".`);
    return match.winner;
  };
  const losersOf = (round: NonNullable<CupEditionLike["knockout"]>[number]): string[] =>
    round.matches.map(match => {
      const winner = winnerOf(match);
      return winner === match.home ? match.away : match.home;
    });

  const finalRound = rounds.at(-1);
  if (finalRound) {
    const final = finalRound.matches.find(match => match.id === "F") ?? finalRound.matches[0];
    if (!final) throw new Error("Completed tournament has no final match.");
    addTier("Winner", [winnerOf(final)], knockoutOrder);
    addTier("Runner-Up", losersOf({ label: "", matches: [final] }), knockoutOrder);
    const thirdPlaceMatch = finalRound.matches.find(match => match.id === "3P");
    if (thirdPlaceMatch) {
      addTier("Third Place", [winnerOf(thirdPlaceMatch)], knockoutOrder);
      addTier("Fourth Place", losersOf({ label: "", matches: [thirdPlaceMatch] }), knockoutOrder);
    } else {
      const semiFinals = rounds.at(-2);
      if (semiFinals) addTier("Semi-Finalists", losersOf(semiFinals), knockoutOrder);
    }
    for (let index = rounds.length - 3; index >= 0; index--) {
      addTier(TIER_LABELS[rounds[index].label] ?? rounds[index].label, losersOf(rounds[index]), knockoutOrder);
    }
  }
  const inKnockout = new Set(rounds[0]?.matches.flatMap(match => [match.home, match.away]) ?? []);
  addTier("Group Stage", source.teams.filter(code => !inKnockout.has(code)), groupOrder);
  return tiers;
}

function getTeamRounds(ranking: PredictedTier[], knockoutRounds: NonNullable<CupEditionLike["knockout"]>): Map<string, number> {
  const totalRounds = knockoutRounds.length + 1;
  const roundsByTeam = new Map<string, number>();
  for (const tier of ranking) {
    let round: number;
    switch (tier.label) {
      case "Winner": round = totalRounds; break;
      case "Runner-Up": round = totalRounds - 1; break;
      case "Third Place":
      case "Fourth Place":
      case "Semi-Finalists": round = totalRounds - 2; break;
      case "Group Stage": round = 0; break;
      default: {
        const index = knockoutRounds.findIndex(item =>
          TIER_LABELS[item.label] === tier.label || item.label === tier.label
        );
        if (index < 0) throw new Error(`Unknown tournament placement tier "${tier.label}".`);
        round = index + 1;
      }
    }
    for (const team of tier.teams) roundsByTeam.set(team, round);
  }
  return roundsByTeam;
}

function getPlacementScore(round: number, totalRounds: number, lambda = 0.5): number {
  if (totalRounds <= 0) return 0;
  const boundedRound = Math.max(0, Math.min(round, totalRounds));
  return totalRounds * (1 - Math.exp(-lambda * boundedRound)) / (1 - Math.exp(-lambda * totalRounds));
}

export function exponentialYouthScore(value: number): number {
  const a = 2.08269;
  const b = 0.00849443;
  const K = 1;
  return (a * (1 - Math.exp(-b * value))) / (1 - Math.exp(-b * K));
}

function applyYouthRatingImpacts(state: InternationalState): void {
  for (const [key, info] of Object.entries(COMPETITIONS) as [CompetitionKey, CompetitionInfo][]) {
    if (info.youth) continue;
    for (const edition of info.editions(state)) {
      if (!edition.completed || edition.youthRatingImpactApplied) continue;
      if (!edition.predictedRanking || !edition.actualRanking || !edition.knockout?.length) {
        throw new Error(`Completed ${key} edition is missing frozen placement data.`);
      }
      const predictedRounds = getTeamRounds(edition.predictedRanking, edition.knockout);
      const actualRounds = getTeamRounds(edition.actualRanking, edition.knockout);
      const totalRounds = edition.knockout.length + 1;
      const updates: [string, number][] = [];
      for (const code of edition.teams) {
        const nation = state.nations[code];
        const predictedRound = predictedRounds.get(code);
        const actualRound = actualRounds.get(code);
        if (!nation || predictedRound === undefined || actualRound === undefined) {
          throw new Error(`Completed ${key} edition has incomplete placement data for "${code}".`);
        }
        const netRoundScore =
          getPlacementScore(actualRound, totalRounds) -
          getPlacementScore(predictedRound, totalRounds);
        const youthScore = exponentialYouthScore(nation.youthRating);
        const ratingChange = netRoundScore >= 0
          ? Math.round((200 - youthScore) * 0.05 * netRoundScore)
          : Math.round(Math.max(0, Math.min(youthScore, 200 - youthScore)) * 0.04 * netRoundScore);
        updates.push([code, Math.max(0, Math.min(200, nation.youthRating + ratingChange))]);
      }
      for (const [code, rating] of updates) state.nations[code].youthRating = rating;
      edition.youthRatingImpactApplied = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Stat leaders
// ---------------------------------------------------------------------------

const LEADERS_SHOWN = 10;

function tournamentMatches(edition: CupEditionLike): InternationalMatch[] {
  return [
    ...edition.groups.flatMap(group => group.matches.flat()),
    ...(edition.knockout ?? []).flatMap(round => round.matches.map(match => match.fixture))
  ];
}

/**
 * Top 10 scorers, assisters and clean-sheet goalkeepers of a tournament. Ties are broken by games played
 * (fewer is better), then the player's overall, then their team's world ranking.
 */
export function computeStatLeaders(
  edition: CupEditionLike,
  playersById: Map<string, Player>,
  strength: Pick<TeamStrength, "rank">
): StatLeaders {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  const cleanSheets = new Map<string, number>();
  const games = new Map<string, number>();
  const nationOf = new Map<string, string>();
  const bump = (counter: Map<string, number>, id: string) => counter.set(id, (counter.get(id) ?? 0) + 1);

  for (const match of tournamentMatches(edition)) {
    if (match.homeGoals === null || match.awayGoals === null) continue;
    for (const side of ["home", "away"] as MatchSide[]) {
      for (const id of match.appearances?.[side] ?? []) {
        bump(games, id);
        nationOf.set(id, match[side]);
      }
      const keeper = match.cleanSheets?.[side];
      if (keeper) bump(cleanSheets, keeper);
    }
    for (const goal of match.goals ?? []) {
      bump(goals, goal.scorerId);
      if (goal.assistId) bump(assists, goal.assistId);
    }
  }

  const leaders = (counter: Map<string, number>): StatLeader[] =>
    [...counter.entries()]
      .map(([playerId, value]): StatLeader => ({
        playerId, value, nation: nationOf.get(playerId) ?? playersById.get(playerId)?.primaryNationality ?? "", games: games.get(playerId) ?? 0
      }))
      .sort((a, b) =>
        b.value - a.value ||
        a.games - b.games ||
        (playersById.get(b.playerId)?.overall ?? 0) - (playersById.get(a.playerId)?.overall ?? 0) ||
        strength.rank(a.nation) - strength.rank(b.nation) ||
        a.playerId.localeCompare(b.playerId))
      .slice(0, LEADERS_SHOWN);

  return { goals: leaders(goals), assists: leaders(assists), cleanSheets: leaders(cleanSheets) };
}

// ---------------------------------------------------------------------------
// Live-or-frozen accessors and completion
// ---------------------------------------------------------------------------

/** The prediction frozen when the tournament was drawn. */
export function getPredictedRanking(edition: CupEditionLike): PredictedTier[] {
  if (!edition.predictedRanking) throw new Error("Tournament prediction has not been frozen.");
  return edition.predictedRanking;
}

/** The frozen final ranking for a completed edition, or null until it completes. */
export function getActualRanking(edition: CupEditionLike): PredictedTier[] | null {
  if (!edition.completed) return null;
  if (!edition.actualRanking) throw new Error("Completed tournament has no frozen actual ranking.");
  return edition.actualRanking;
}

/** The frozen stat leaders for a finished edition, otherwise computed from the matches played so far. */
export function getStatLeaders(state: InternationalState, competition: CompetitionKey, edition: CupEditionLike, playersById: Map<string, Player>): StatLeaders {
  return edition.statLeaders ?? computeStatLeaders(edition, playersById, createTeamStrength(state, COMPETITIONS[competition].youth));
}

/** Freezes predictions for every tournament that has been drawn. Safe to call at every draw point. */
export function freezeTournamentPredictions(state: InternationalState): void {
  for (const [key, info] of Object.entries(COMPETITIONS) as [CompetitionKey, CompetitionInfo][]) {
    for (const edition of info.editions(state)) {
      if (edition.predictedRanking || edition.groups.length === 0) continue;
      edition.predictedRanking = predictRanking(key, edition, createTeamStrength(state, info.youth));
    }
  }
}

/** Freezes predictions for drawn tournaments and actual results/stats for every completed edition. */
export function freezeCompletedEditions(
  state: InternationalState,
  playersById: Map<string, Player>,
  applyYouthImpacts = true
): void {
  freezeTournamentPredictions(state);
  for (const [key, info] of Object.entries(COMPETITIONS) as [CompetitionKey, CompetitionInfo][]) {
    for (const edition of info.editions(state)) {
      if (!edition.completed || (edition.actualRanking && edition.statLeaders)) continue;
      const strength = createTeamStrength(state, info.youth);
      edition.actualRanking ??= rankActualResults(edition, strength);
      edition.statLeaders ??= computeStatLeaders(edition, playersById, strength);
    }
  }
  if (applyYouthImpacts) applyYouthRatingImpacts(state);
}

/** Freezes missing snapshots when loading a save without applying tournament effects retroactively. */
export function initializeSavedTournamentInsights(state: InternationalState, playersById: Map<string, Player>): void {
  freezeCompletedEditions(state, playersById, false);
  for (const [key, info] of Object.entries(COMPETITIONS) as [CompetitionKey, CompetitionInfo][]) {
    if (info.youth) continue;
    for (const edition of info.editions(state)) {
      if (edition.completed) edition.youthRatingImpactApplied ??= true;
    }
  }
}
