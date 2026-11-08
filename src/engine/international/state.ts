import nationInfoRaw from "../nations/data/nation_info.json";
import { createAfcCupState } from "./competitions/afcCup";
import { createAfconState } from "./competitions/afcon";
import { createConfedCupState } from "./competitions/confedCup";
import { createU20WorldCupState } from "./competitions/u20WorldCup";
import { createCopaAmericaState } from "./competitions/copaAmerica";
import { createEuroQualifiersState } from "./competitions/euroQualifiers";
import { createEuroState } from "./competitions/euros";
import { createGoldCupState } from "./competitions/goldCup";
import { createNationsLeagueState } from "./competitions/nationsLeague";
import { createOfcCupState } from "./competitions/ofcCup";
import { createWorldCupState } from "./competitions/worldcup/worldCup";
import { createEmptySquadState } from "./squads";
import type { InternationalState, NationTeam } from "./types";

interface NationInfoRow {
  threeLetterCode: string;
  youthRating: number;
  rankingPts: number;
}

/** A fresh international world: every nation at its starting ranking points, no competitions drawn yet (squads and overalls are filled in once players are loaded). */
export function createInternationalState(): InternationalState {
  const nations: Record<string, NationTeam> = {};
  for (const info of Object.values(nationInfoRaw as Record<string, NationInfoRow>)) {
    nations[info.threeLetterCode] = {
      code: info.threeLetterCode,
      overall: 0,
      points: info.rankingPts,
      youthRating: info.youthRating,
      goldenGeneration: null,
      formation: "4-4-2",
      formationLocked: false,
      startingXI: [],
      substitutes: [],
      u20: createEmptySquadState()
    };
  }

  return {
    nations,
    windows: [],
    rankingHistory: [],
    nationsLeague: createNationsLeagueState(),
    goldCup: createGoldCupState(),
    copaAmerica: createCopaAmericaState(),
    confedCup: createConfedCupState(),
    u20WorldCup: createU20WorldCupState(),
    afcon: createAfconState(),
    afcCup: createAfcCupState(),
    ofcCup: createOfcCupState(),
    euroQualifiers: createEuroQualifiersState(),
    euro: createEuroState(),
    worldCup: createWorldCupState(),
    lastLeftOut: null
  };
}
