import type { InternationalRound } from "../types";
import type { InternationalCompetitionEdition } from "./cupCommon";

const GROUP_ROUND_LABELS = { goldCup: "Gold Cup", copaAmerica: "Copa América", confedCup: "Confederations Cup", u20WorldCup: "U20 World Cup" } as const;

/** The three group-stage rounds of a Gold Cup or Copa América edition. */
export function createCupGroupRounds(
  edition: InternationalCompetitionEdition,
  competition: keyof typeof GROUP_ROUND_LABELS
): InternationalRound[] {
  return [0, 1, 2].map(roundIndex => ({
    kind: competition,
    label: `${GROUP_ROUND_LABELS[competition]} · Group stage · Matchday ${roundIndex + 1}`,
    leftOut: null,
    matches: edition.groups.flatMap(group => group.matches[roundIndex])
  }));
}
