import { advanceWorldCupKnockout, startWorldCupRoundOf32 } from "./competitions/worldcup/tournament";
import type { InternationalCompetitionEdition } from "./competitions/cupCommon";
import type { WorldCupTournament } from "./competitions/worldcup/types";
import { computeRankings } from "./rankings";
import { TOURNAMENTS } from "./roundProgression";
import type { Player } from "../players/types";
import type {
  InternationalMatch, InternationalRound, InternationalState, MatchSide, PredictedTier, StatLeader, StatLeaders
} from "./types";

/**
 * Predictions and stat leaders for the cup tournaments (not qualifiers or the Nations League).
 * Both are computed live while a tournament is in progress and frozen onto the edition when it completes.
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
  statLeaders?: StatLeaders;
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

/** The frozen ranking for a finished edition, otherwise computed from the current team overalls. */
export function getPredictedRanking(state: InternationalState, competition: CompetitionKey, edition: CupEditionLike): PredictedTier[] {
  return edition.predictedRanking ?? predictRanking(competition, edition, createTeamStrength(state, COMPETITIONS[competition].youth));
}

/** The frozen stat leaders for a finished edition, otherwise computed from the matches played so far. */
export function getStatLeaders(state: InternationalState, competition: CompetitionKey, edition: CupEditionLike, playersById: Map<string, Player>): StatLeaders {
  return edition.statLeaders ?? computeStatLeaders(edition, playersById, createTeamStrength(state, COMPETITIONS[competition].youth));
}

/** Freezes the prediction and stat leaders of any tournament that has just completed. */
export function freezeCompletedEditions(state: InternationalState, playersById: Map<string, Player>): void {
  for (const [key, info] of Object.entries(COMPETITIONS) as [CompetitionKey, CompetitionInfo][]) {
    const latest = info.editions(state).at(-1);
    if (!latest || !latest.completed || (latest.predictedRanking && latest.statLeaders)) continue;
    const strength = createTeamStrength(state, info.youth);
    latest.predictedRanking = predictRanking(key, latest, strength);
    latest.statLeaders = computeStatLeaders(latest, playersById, strength);
  }
}
