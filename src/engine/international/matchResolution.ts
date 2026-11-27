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
import { createGoalInfo, getFinals, getPlayoff, getQualifying, setMatchWinner } from "./matchInfo";
import type { CompetitionName, InternationalMatch, InternationalState } from "./types";
import type { InternationalCompetitionEdition } from "./competitions/cupCommon";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** U20 tournament matches are played by the nations' U20 teams. */
export const isYouthMatch = (match: InternationalMatch): boolean => match.kind.startsWith("u20");

const toMatchTeam = (state: InternationalState, code: string, youth = false): MatchTeam => ({
  code, overall: youth ? state.nations[code].u20.overall : state.nations[code].overall
});

export function isKnockoutMatch(match: InternationalMatch): boolean {
  const competition = match.competitionInformation;
  if (!competition) return false;
  switch (competition.competitionName) {
    case "worldCup":
      return competition.playoffOptions?.pathMatch !== undefined || competition.finalsInfo?.knockoutMatchId !== undefined;
    case "u20Qualifier":
      return competition.playoffOptions?.stage === "playoff";
    case "euro":
      return competition.playoffOptions?.stage === "playoff" || competition.finalsInfo?.stage === "knockout";
    default:
      return competition.finalsInfo?.stage === "knockout";
  }
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
function decideTie(state: InternationalState, tie: TieRef, secondLegHomeGoals: number, secondLegAwayGoals: number, youth = false) {
  const aggregateTeam1 = tie.firstLeg.goalInfo!.homeGoals + secondLegAwayGoals;
  const aggregateTeam2 = tie.firstLeg.goalInfo!.awayGoals + secondLegHomeGoals;
  if (aggregateTeam1 !== aggregateTeam2) {
    return { winner: aggregateTeam1 > aggregateTeam2 ? tie.team1 : tie.team2, shootout: null };
  }
  const shootout = simulatePenaltyShootoutOnly(toMatchTeam(state, tie.team1, youth), toMatchTeam(state, tie.team2, youth));
  return { winner: parseKOMatchWinner(shootout).code, shootout };
}

function assertFirstLegPlayed(tie: TieRef | undefined | null, description: string): asserts tie is TieRef {
  if (!tie || tie.firstLeg.goalInfo === null) {
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

  const goldCup = getPlayoff(match, "goldCup");
  if (goldCup?.playoffId && goldCup.tieId && goldCup.leg === 2) {
    const { playoffId, tieId } = goldCup;
    const tie = getGoldCupPlayoff(state.goldCup, playoffId).ties.find(candidate => candidate.id === tieId);
    assertFirstLegPlayed(tie, `Gold Cup playoff tie "${tieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveGoldCupPlayoffTie(state.goldCup, playoffId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  const afcon = getQualifying(match, "afcon");
  if (afcon?.qualifierId && afcon.tieId && afcon.leg === 2) {
    const { qualifierId, tieId } = afcon;
    const tie = getAfconQualifier(state.afcon, qualifierId).preliminaryTies.find(candidate => candidate.id === tieId);
    assertFirstLegPlayed(tie, `AFCON preliminary tie "${tieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveAfconPreliminaryTie(state.afcon, qualifierId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  const afcCup = getQualifying(match, "afcCup");
  if (afcCup?.qualifierId && afcCup.tieId && afcCup.leg === 2) {
    const { qualifierId, tieId } = afcCup;
    const tie = getAfcCupQualifier(state.afcCup, qualifierId).preliminaryTies.find(candidate => candidate.id === tieId);
    assertFirstLegPlayed(tie, `Asian Cup preliminary tie "${tieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return {
      winner, shootout,
      commit: () => resolveAfcCupPreliminaryTie(state.afcCup, qualifierId, tie.id, winner, shootoutPenalties(shootout))
    };
  }
  const worldCupQualifying = getQualifying(match, "worldCup");
  const worldCupPlayoff = getPlayoff(match, "worldCup");
  const worldCup = worldCupQualifying ?? worldCupPlayoff;
  const worldCupEditionId = worldCupQualifying ? worldCupQualifying.qualifierId : worldCupPlayoff?.playoffId;
  if (worldCup && worldCupEditionId && worldCup.tieId && worldCup.leg === 2) {
    const edition = state.worldCup.editions.find(item => item.id === worldCupEditionId);
    const tie = edition ? findWorldCupTie(edition, worldCup.tieId) : null;
    assertFirstLegPlayed(tie, `World Cup qualifying tie "${worldCup.tieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals);
    return { winner, shootout, commit: () => { tie.winner = winner; } };
  }
  const u20 = getQualifying(match, "u20Qualifier");
  if (u20?.qualifierId && u20.tieId && u20.leg === 2) {
    const edition = state.u20Qualifying.editions.find(item => item.id === u20.qualifierId);
    const tie = edition?.confederations[u20.confederation ?? ""]?.ties.find(item => item.id === u20.tieId);
    assertFirstLegPlayed(tie, `U20 qualifying tie "${u20.tieId}"`);
    const { winner, shootout } = decideTie(state, tie, homeGoals, awayGoals, true);
    return { winner, shootout, commit: () => { tie.winner = winner; } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Knockout winners
// ---------------------------------------------------------------------------

/** Cups whose knockout fixtures register their winner on the edition. */
const KNOCKOUT_CUPS: readonly {
  name: CompetitionName; label: string; editions: (s: InternationalState) => InternationalCompetitionEdition[]
}[] = [
  { name: "goldCup", label: "Gold Cup", editions: (s: InternationalState) => s.goldCup.editions },
  { name: "copaAmerica", label: "Copa América", editions: (s: InternationalState) => s.copaAmerica.editions },
  { name: "confedCup", label: "Confederations Cup", editions: (s: InternationalState) => s.confedCup.editions },
  { name: "u20WorldCup", label: "U20 World Cup", editions: (s: InternationalState) => s.u20WorldCup.editions },
  { name: "afcon", label: "AFCON", editions: (s: InternationalState) => s.afcon.editions },
  { name: "afcCup", label: "Asian Cup", editions: (s: InternationalState) => s.afcCup.editions },
  { name: "ofcCup", label: "OFC Cup", editions: (s: InternationalState) => s.ofcCup.editions }
];

function recordKnockoutWinner(state: InternationalState, match: InternationalMatch, winner: string): void {
  for (const cup of KNOCKOUT_CUPS) {
    const cupFinals = getFinals(match, cup.name);
    if (!cupFinals?.editionId || !cupFinals.knockoutMatchId) continue;
    const edition = cup.editions(state).find(candidate => candidate.id === cupFinals.editionId);
    if (!edition) throw new Error(`Unknown ${cup.label} edition "${cupFinals.editionId}".`);
    cupFinals.winner = winner;
    setInternationalCupKnockoutWinner(edition, cupFinals.knockoutMatchId, winner);
  }

  const u20 = getPlayoff(match, "u20Qualifier");
  if (u20?.stage === "playoff") {
    const edition = state.u20Qualifying.editions.find(
      item => item.id === u20.playoffId
    );

    if (u20.confederation === "CONMEBOL") {
      const knockoutMatch = edition?.confederations.CONMEBOL.knockout
        .flatMap(round => round.matches)
        .find(item => item.id === u20.knockoutMatchId);

      if (knockoutMatch) knockoutMatch.winner = winner;
    } else if (u20.confederation === "ICPO") {
      const playoffMatch = edition?.playoff
        ?.flatMap(round => round.matches)
        .find(item => item.id === u20.knockoutMatchId);

      if (playoffMatch) playoffMatch.winner = winner;
    }
  }

  const euroPlayoff = getPlayoff(match, "euro");
  const euroFinals = getFinals(match, "euro");
  if (euroPlayoff?.stage === "playoff" || euroFinals?.stage === "knockout") {
    setMatchWinner(match, winner);
    if (euroFinals?.editionId && euroFinals.knockoutMatchId) {
      const edition = state.euro.editions.find(candidate => candidate.id === euroFinals.editionId);
      if (!edition) throw new Error(`Unknown EURO edition "${euroFinals.editionId}".`);
      setInternationalCupKnockoutWinner(edition, euroFinals.knockoutMatchId, winner);
    }
  }
  const worldCupFinals = getFinals(match, "worldCup");
  if (worldCupFinals?.stage === "knockout" && worldCupFinals.editionId && worldCupFinals.knockoutMatchId) {
    const edition = getWorldCupEdition(state.worldCup, worldCupFinals.editionId);
    worldCupFinals.winner = winner;
    if (edition.tournament) recordWorldCupKnockoutWinner(edition.tournament, worldCupFinals.knockoutMatchId, winner);
  } else if (getPlayoff(match, "worldCup")?.pathMatch !== undefined) {
    setMatchWinner(match, winner);
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
    : simulateMatch(homeTeam, awayTeam, isKnockoutMatch(match), match.kind);
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

  const goalInfo = createGoalInfo(homeGoals, awayGoals);
  match.goalInfo = goalInfo;
  // Youth matches do not affect the senior world rankings (their changes stay 0).
  if (!youth) {
    const importance = MATCH_IMPORTANCE[match.kind];
    const homeChange = rankingPointChange(home.points, away.points, importance, homeOutcome, { shootout: hasShootout });
    const awayChange = rankingPointChange(away.points, home.points, importance, awayOutcome, { shootout: hasShootout });
    home.points = round2(home.points + homeChange);
    away.points = round2(away.points + awayChange);
    goalInfo.homeChange = round2(homeChange);
    goalInfo.awayChange = round2(awayChange);
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
