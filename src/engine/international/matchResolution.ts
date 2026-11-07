import { parseKOMatchWinner, simulateMatch, simulatePenaltyShootoutOnly } from "../match/matchEngine";
import type { MatchResult, MatchTeam } from "../match/types";
import { resolveAfcCupPreliminaryTie } from "./competitions/afcCup";
import { resolveAfconPreliminaryTie } from "./competitions/afcon";
import { resolveGoldCupPlayoffTie } from "./competitions/goldCup";
import { findWorldCupTie } from "./competitions/worldcup/utils";
import { setInternationalCupKnockoutWinner } from "./competitions/cupCommon";
import { getWorldCupEdition } from "./competitions/worldcup/worldCup";
import { recordWorldCupKnockoutWinner } from "./competitions/worldcup/tournament";
import { getGoldCupPlayoff } from "./competitions/goldCup";
import { getAfconQualifier } from "./competitions/afcon";
import { getAfcCupQualifier } from "./competitions/afcCup";
import { MATCH_IMPORTANCE, rankingPointChange } from "./rankings";
import type { MatchOutcome } from "./rankings";
import type { InternationalMatch, InternationalState } from "./types";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** U20 tournament matches are played by the nations' U20 teams. */
export const isYouthMatch = (match: InternationalMatch): boolean => match.kind.startsWith("u20WorldCup");

const toMatchTeam = (state: InternationalState, code: string, youth = false): MatchTeam => ({
  code, overall: youth ? state.nations[code].u20.overall : state.nations[code].overall
});

export function isKnockoutMatch(match: InternationalMatch): boolean {
  return match.goldCupStage === "knockout" || match.copaAmericaStage === "knockout" || match.confedCupStage === "knockout" ||
    match.u20WorldCupStage === "knockout" ||
    match.afconStage === "knockout" || match.afcCupStage === "knockout" || match.ofcCupStage === "knockout" ||
    match.euroStage === "playoff" || match.euroStage === "knockout" ||
    match.worldCupPathMatch !== undefined || match.worldCupKnockoutMatchId !== undefined;
}

// ---------------------------------------------------------------------------
// Two-legged ties
// ---------------------------------------------------------------------------

interface TieResolution {
  winner: string;
  /** Set only when the tie is level on aggregate and goes to a shootout. */
  shootout: MatchResult | null;
  /** Records the winner in the competition that owns the tie. */
  commit: () => void;
}

interface TieRef {
  team1: string;
  team2: string;
  firstLeg: InternationalMatch;
}

/** Winner by aggregate over two legs, or by a penalty shootout when level. */
function decideTie(state: InternationalState, tie: TieRef, secondLegHomeGoals: number, secondLegAwayGoals: number) {
  const aggregateTeam1 = tie.firstLeg.homeGoals! + secondLegAwayGoals;
  const aggregateTeam2 = tie.firstLeg.awayGoals! + secondLegHomeGoals;
  if (aggregateTeam1 !== aggregateTeam2) {
    return { winner: aggregateTeam1 > aggregateTeam2 ? tie.team1 : tie.team2, shootout: null };
  }
  const shootout = simulatePenaltyShootoutOnly(toMatchTeam(state, tie.team1), toMatchTeam(state, tie.team2));
  return { winner: parseKOMatchWinner(shootout).code, shootout };
}

function assertFirstLegPlayed(tie: TieRef | undefined | null, description: string): asserts tie is TieRef {
  if (!tie || tie.firstLeg.homeGoals === null || tie.firstLeg.awayGoals === null) {
    throw new Error(`${description} has no completed first leg.`);
  }
}

/** If this match is the second leg of a tracked two-legged tie, settles the tie (aggregate or shootout). */
function resolveSecondLeg(
  state: InternationalState,
  match: InternationalMatch,
  homeGoals: number,
  awayGoals: number
): TieResolution | null {
  const shootoutPenalties = (shootout: MatchResult | null) =>
    shootout ? { home: shootout.homeGoalInfo.penalties ?? [], away: shootout.awayGoalInfo.penalties ?? [] } : null;

  if (match.goldCupPlayoffId && match.goldCupTieId && match.goldCupLeg === 2) {
    const playoffId = match.goldCupPlayoffId;
    const tie = getGoldCupPlayoff(state.goldCup, playoffId).ties.find(candidate => candidate.id === match.goldCupTieId);
    assertFirstLegPlayed(tie, `Gold Cup playoff tie "${match.goldCupTieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveGoldCupPlayoffTie(state.goldCup, playoffId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  if (match.afconQualifierId && match.afconTieId && match.afconLeg === 2) {
    const qualifierId = match.afconQualifierId;
    const tie = getAfconQualifier(state.afcon, qualifierId).preliminaryTies.find(candidate => candidate.id === match.afconTieId);
    assertFirstLegPlayed(tie, `AFCON preliminary tie "${match.afconTieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveAfconPreliminaryTie(state.afcon, qualifierId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  if (match.afcCupQualifierId && match.afcCupTieId && match.afcCupLeg === 2) {
    const qualifierId = match.afcCupQualifierId;
    const tie = getAfcCupQualifier(state.afcCup, qualifierId).preliminaryTies.find(candidate => candidate.id === match.afcCupTieId);
    assertFirstLegPlayed(tie, `Asian Cup preliminary tie "${match.afcCupTieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveAfcCupPreliminaryTie(state.afcCup, qualifierId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  if (match.worldCupEditionId && match.worldCupTieId && match.worldCupLeg === 2) {
    const edition = state.worldCup.editions.find(item => item.id === match.worldCupEditionId);
    const tie = edition ? findWorldCupTie(edition, match.worldCupTieId) : null;
    assertFirstLegPlayed(tie, `World Cup qualifying tie "${match.worldCupTieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return { winner, shootout, commit: () => { tie.winner = winner; } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Knockout winners
// ---------------------------------------------------------------------------

/** Cups whose knockout fixtures register their winner on the edition (fields are `<prefix>EditionId` etc.). */
const KNOCKOUT_CUPS = [
  { prefix: "goldCup", name: "Gold Cup", editions: (s: InternationalState) => s.goldCup.editions },
  { prefix: "copaAmerica", name: "Copa América", editions: (s: InternationalState) => s.copaAmerica.editions },
  { prefix: "confedCup", name: "Confederations Cup", editions: (s: InternationalState) => s.confedCup.editions },
  { prefix: "u20WorldCup", name: "U20 World Cup", editions: (s: InternationalState) => s.u20WorldCup.editions },
  { prefix: "afcon", name: "AFCON", editions: (s: InternationalState) => s.afcon.editions },
  { prefix: "afcCup", name: "Asian Cup", editions: (s: InternationalState) => s.afcCup.editions },
  { prefix: "ofcCup", name: "OFC Cup", editions: (s: InternationalState) => s.ofcCup.editions }
] as const;

function recordKnockoutWinner(state: InternationalState, match: InternationalMatch, winner: string): void {
  const fields = match as unknown as Record<string, string | undefined>;
  for (const cup of KNOCKOUT_CUPS) {
    const editionId = fields[`${cup.prefix}EditionId`];
    const matchId = fields[`${cup.prefix}KnockoutMatchId`];
    if (!editionId || !matchId) continue;
    const edition = cup.editions(state).find(candidate => candidate.id === editionId);
    if (!edition) throw new Error(`Unknown ${cup.name} edition "${editionId}".`);
    fields[`${cup.prefix}Winner`] = winner;
    setInternationalCupKnockoutWinner(edition, matchId, winner);
  }

  if (match.euroStage === "playoff" || match.euroStage === "knockout") {
    match.euroWinner = winner;
    if (match.euroEditionId && match.euroKnockoutMatchId) {
      const edition = state.euro.editions.find(candidate => candidate.id === match.euroEditionId);
      if (!edition) throw new Error(`Unknown EURO edition "${match.euroEditionId}".`);
      setInternationalCupKnockoutWinner(edition, match.euroKnockoutMatchId, winner);
    }
  }
  if (match.worldCupStage === "knockout" && match.worldCupEditionId && match.worldCupKnockoutMatchId) {
    const edition = getWorldCupEdition(state.worldCup, match.worldCupEditionId);
    match.worldCupWinner = winner;
    if (edition.tournament) recordWorldCupKnockoutWinner(edition.tournament, match.worldCupKnockoutMatchId, winner);
  } else if (match.worldCupPathMatch !== undefined) {
    match.worldCupWinner = winner;
  }
}

// ---------------------------------------------------------------------------
// Playing a match
// ---------------------------------------------------------------------------

/** God Mode: the forced scoreline as a match result (a drawn knockout goes to a randomized shootout). */
function createRiggedResult(
  rigged: NonNullable<InternationalMatch["rigged"]>,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
  isKnockout: boolean
): MatchResult {
  const shootout = isKnockout && rigged.homeGoals === rigged.awayGoals
    ? simulatePenaltyShootoutOnly(homeTeam, awayTeam)
    : null;
  return {
    homeGoalInfo: { homeTeam, homeGoals: rigged.homeGoals, penalties: shootout?.homeGoalInfo.penalties ?? null },
    awayGoalInfo: { awayTeam, awayGoals: rigged.awayGoals, penalties: shootout?.awayGoalInfo.penalties ?? null }
  };
}

/** Plays one fixture: simulates it, updates both nations' ranking points and records its result. */
export function playMatch(state: InternationalState, match: InternationalMatch): void {
  const home = state.nations[match.home];
  const away = state.nations[match.away];
  const youth = isYouthMatch(match);
  const homeTeam = toMatchTeam(state, match.home, youth);
  const awayTeam = toMatchTeam(state, match.away, youth);

  const result = match.rigged
    ? createRiggedResult(match.rigged, homeTeam, awayTeam, isKnockoutMatch(match))
    : simulateMatch(homeTeam, awayTeam, isKnockoutMatch(match), "LEAGUE");
  const homeGoals = result.homeGoalInfo.homeGoals;
  const awayGoals = result.awayGoalInfo.awayGoals;
  const tie = resolveSecondLeg(state, match, homeGoals, awayGoals);

  // A tie shootout only decides this match when the second leg itself finished level.
  const tieShootout = tie?.shootout && homeGoals === awayGoals ? tie.shootout : null;
  const hasShootout = Boolean((result.homeGoalInfo.penalties && result.awayGoalInfo.penalties) || tieShootout);

  const homeWon = tieShootout
    ? tie!.winner === match.home
    : parseKOMatchWinner(result).code === homeTeam.code;
  const homeOutcome: MatchOutcome = hasShootout
    ? (homeWon ? "win" : "loss")
    : homeGoals > awayGoals ? "win" : homeGoals < awayGoals ? "loss" : "draw";
  const awayOutcome: MatchOutcome = homeOutcome === "win" ? "loss" : homeOutcome === "loss" ? "win" : "draw";

  match.homeGoals = homeGoals;
  match.awayGoals = awayGoals;
  // Youth matches do not affect the senior world rankings.
  if (!youth) {
    const importance = MATCH_IMPORTANCE[match.kind];
    const homeChange = rankingPointChange(home.points, away.points, importance, homeOutcome, { shootout: hasShootout });
    const awayChange = rankingPointChange(away.points, home.points, importance, awayOutcome, { shootout: hasShootout });
    home.points = round2(home.points + homeChange);
    away.points = round2(away.points + awayChange);
    match.homeChange = round2(homeChange);
    match.awayChange = round2(awayChange);
  }
  // The tie shootout was simulated with the first-leg home side first, so its sides are swapped here.
  match.homePenalties = result.homeGoalInfo.penalties ??
    (tieShootout ? [...(tieShootout.awayGoalInfo.penalties ?? [])] : undefined);
  match.awayPenalties = result.awayGoalInfo.penalties ??
    (tieShootout ? [...(tieShootout.homeGoalInfo.penalties ?? [])] : undefined);

  tie?.commit();

  const winner = hasShootout ? parseKOMatchWinner(result).code : homeGoals > awayGoals ? match.home : match.away;
  recordKnockoutWinner(state, match, winner);
}
