import type { InternationalState } from "./types";

export interface Trophy {
  name: string;
  /** Calendar year the final was played (a season's tournaments are played in its second calendar year). */
  year: number;
}

interface CompletedEdition {
  year: number;
  completed: boolean;
  winner: string | null;
}

/** Every tournament a nation has won, newest first. */
export function getNationTrophies(state: InternationalState, code: string): Trophy[] {
  const tournaments: [string, CompletedEdition[]][] = [
    ["Gold Cup Winners", state.goldCup.editions],
    ["Copa América Winners", state.copaAmerica.editions],
    ["Confederations Cup Winners", state.confedCup.editions],
    ["U20 World Cup Winners", state.u20WorldCup.editions],
    ["AFCON Winners", state.afcon.editions],
    ["Asian Cup Winners", state.afcCup.editions],
    ["OFC Cup Winners", state.ofcCup.editions],
    ["EURO Winners", state.euro.editions],
    ["World Cup Winners", state.worldCup.editions.flatMap(edition => edition.tournament ? [edition.tournament] : [])]
  ];
  return tournaments
    .flatMap(([name, editions]) => editions
      .filter(edition => edition.completed && edition.winner === code)
      .map(edition => ({ name, year: edition.year + 1 })))
    .sort((a, b) => b.year - a.year);
}
