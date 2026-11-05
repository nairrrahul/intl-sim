import { createTwentyFourTeamRoundOf16, pairKnockoutWinners } from "../../shared/knockout24";
import type { InternationalRound } from "../types";
import {
  THIRD_PLACE_MATCH_ID, createMatch, getInternationalCupStandings, getKnockoutLosers
} from "./cupCommon";
import type {
  InternationalCompetitionEdition, InternationalCompetitionKnockoutMatch, InternationalCompetitionKnockoutRound
} from "./cupCommon";

/**
 * The knockout of a 24-team tournament (six groups of four): round of 16, quarter-finals, semi-finals,
 * then a final with a third-place match. Shared by AFCON and the U20 World Cup; their fixtures differ only
 * in the competition-prefixed fields (e.g. `afconStage`, `u20WorldCupStage`).
 */
export type TwentyFourTeamCup = "afcon" | "u20WorldCup";

function makeKnockoutMatch(
  edition: InternationalCompetitionEdition,
  competition: TwentyFourTeamCup,
  id: string,
  home: string,
  away: string
): InternationalCompetitionKnockoutMatch {
  const fixture = createMatch(home, away, `${competition}Knockout`, edition.year, edition.windowId, {
    [`${competition}EditionId`]: edition.id,
    [`${competition}Stage`]: "knockout",
    [`${competition}KnockoutMatchId`]: id
  });
  return { id, home, away, fixture, winner: null };
}

function toRound(
  competition: TwentyFourTeamCup,
  labelPrefix: string,
  label: string,
  matches: InternationalCompetitionKnockoutMatch[]
): InternationalRound {
  return { kind: competition, label: `${labelPrefix} · ${label}`, leftOut: null, matches: matches.map(match => match.fixture) };
}

/** Draws the round of 16 once every group match is played (group winners, runners-up and the four best third places). */
export function startTwentyFourTeamRoundOf16(
  edition: InternationalCompetitionEdition,
  competition: TwentyFourTeamCup,
  labelPrefix: string
): InternationalRound | null {
  if (edition.groups.some(group => group.matches.flat().some(match => match.homeGoals === null || match.awayGoals === null))) {
    return null;
  }
  const groups = edition.groups.map(group => getInternationalCupStandings(edition, group).map((row, index) => ({
    group: group.name,
    code: row.code,
    position: index + 1,
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor,
    worldRank: edition.seedRanks[row.code] ?? Number.MAX_SAFE_INTEGER
  })));
  const matches = createTwentyFourTeamRoundOf16(groups).map((pair, index) =>
    makeKnockoutMatch(edition, competition, `R16-${index + 1}`, pair.home, pair.away)
  );
  edition.knockout = [{ label: "Round of 16", matches }];
  return toRound(competition, labelPrefix, "Round of 16", matches);
}

const NEXT_ROUND: Record<number, { label: InternationalCompetitionKnockoutRound["label"]; idPrefix: string }> = {
  4: { label: "Quarter-finals", idPrefix: "QF" },
  2: { label: "Semi-finals", idPrefix: "SF" },
  1: { label: "Final", idPrefix: "F" }
};

/** Draws the next knockout round from the winners of `roundIndex`, or completes the tournament after the final. */
export function advanceTwentyFourTeamKnockout(
  edition: InternationalCompetitionEdition,
  roundIndex: number,
  competition: TwentyFourTeamCup,
  labelPrefix: string
): InternationalRound | null {
  const round = edition.knockout?.[roundIndex];
  if (!round || round.matches.some(match => match.winner === null)) return null;

  if (round.label === "Final") {
    const final = round.matches[0];
    edition.winner = final.winner;
    edition.runnerUp = final.winner === final.home ? final.away : final.home;
    edition.thirdPlace = round.matches.find(match => match.id === THIRD_PLACE_MATCH_ID)?.winner ?? null;
    edition.completed = true;
    const semifinals = edition.knockout?.find(item => item.label === "Semi-finals");
    edition.semifinalists = semifinals?.matches.flatMap(match =>
      match.winner ? [match.winner === match.home ? match.away : match.home] : []
    ) ?? [];
    return null;
  }

  const pairings = pairKnockoutWinners(round.matches.map(match => match.winner as string));
  const next = NEXT_ROUND[pairings.length];
  const matches = pairings.map((pair, index) =>
    makeKnockoutMatch(
      edition, competition,
      next.label === "Final" ? next.idPrefix : `${next.idPrefix}-${index + 1}`,
      pair.home, pair.away
    )
  );
  if (next.label === "Final") {
    const [first, second] = getKnockoutLosers(round.matches);
    matches.push(makeKnockoutMatch(edition, competition, THIRD_PLACE_MATCH_ID, first, second));
  }
  edition.knockout?.push({ label: next.label, matches });
  return toRound(competition, labelPrefix, next.label, matches);
}
