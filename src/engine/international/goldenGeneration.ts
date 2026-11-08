import { getWorldRanks } from "./rankings";
import type { InternationalState, NationTeam } from "./types";
import { pickRandom, randInt, uniform } from "../shared/random";
import { exponentialNationOverallScore } from "./editionInsights";


function endGoldenGeneration(nation: NationTeam, currentRank: number): void {
  const generation = nation.goldenGeneration;
  if (!generation) return;
  const reduction = (1 - Math.max(currentRank - generation.startingNationalTeamRank, 0) / 211) * generation.amount;
  nation.youthRating = Math.round(Math.max(0, Math.min(200, nation.youthRating - reduction)));
  nation.goldenGeneration = null;
}

function startGoldenGeneration(nation: NationTeam, startingRank: number): void {
  const amount = uniform(0.4, 0.65) * (100 - exponentialNationOverallScore(nation.overall));
  const updatedRating = Math.round(Math.max(0, Math.min(nation.youthRating*3.5, Math.min(200, nation.youthRating + amount))));
  nation.goldenGeneration = {
    startingNationalTeamRank: startingRank,
    yearsLeft: randInt(5, 9),
    amount: updatedRating - nation.youthRating
  };
  console.log(nation);
  nation.youthRating = updatedRating;
}

/** Advances active golden generations and starts new ones at the beginning of a season. */
export function advanceGoldenGenerations(state: InternationalState): void {
  const ranks = getWorldRanks(state);
  for (const nation of Object.values(state.nations)) {
    if (!nation.goldenGeneration) continue;
    nation.goldenGeneration.yearsLeft -= 1;
    if (nation.goldenGeneration.yearsLeft <= 0) {
      endGoldenGeneration(nation, ranks[nation.code] ?? 212);
    }
  }

  const eligible = Object.values(state.nations).filter(nation => nation.goldenGeneration === null);
  if (eligible.length === 0) return;
  const generationCount = Math.min(randInt(1, 3), eligible.length);
  const selected: NationTeam[] = [];
  while (selected.length < generationCount) {
    const nation = pickRandom(eligible);
    eligible.splice(eligible.indexOf(nation), 1);
    selected.push(nation);
  }
  for (const nation of selected) startGoldenGeneration(nation, ranks[nation.code] ?? 212);
}
