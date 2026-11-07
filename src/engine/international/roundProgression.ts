import { findUpcomingWindow } from "./calendar/windows";
import { getNextCompetitionWindow } from "./calendar/windowCalendar";
import { advanceConfedCupRound } from "./competitions/confedCup";
import { advanceTwentyFourTeamKnockout, startTwentyFourTeamRoundOf16 } from "./competitions/twentyFourTeamKnockout";
import { advanceInternationalCupRound } from "./competitions/cupCommon";
import type { InternationalCompetitionEdition } from "./competitions/cupCommon";
import {
  advanceAfconKnockoutRound, completeAfconMainQualifiers, completeAfconPreliminary, getAfconQualifier,
  startAfconRoundOf16
} from "./competitions/afcon";
import {
  advanceAfcCupKnockoutRound, completeAfcCupMainQualifiers, completeAfcCupPreliminary, getAfcCupQualifier,
  startAfcCupRoundOf16
} from "./competitions/afcCup";
import { advanceOfcCupKnockoutRound, completeOfcCupQualifiers, getOfcCupQualifier, startOfcCupSemiFinals } from "./competitions/ofcCup";
import {
  completeEuroMainQualifying, getEuroPlayoffFinalRound, getEuroQualifyingEdition, getEuroWindowType,
  recordEuroPlayoffRound
} from "./competitions/euroQualifiers";
import { advanceEuroKnockoutRound, createEuroEdition, startEuroRoundOf16 } from "./competitions/euros";
import {
  completeGoldCupPlayoff, createGoldCupEdition, getGoldCupPlayoff, getGoldCupWindowType
} from "./competitions/goldCup";
import { completeAfricaPlayoff, completeAfricaQualifying } from "./competitions/worldcup/africa";
import { completeAsiaPreliminary, completeAsiaSecondRound, completeAsiaThirdRound } from "./competitions/worldcup/asia";
import {
  completeConcacafPreliminary, completeConcacafSecondRound, completeConcacafThirdRound
} from "./competitions/worldcup/concacaf";
import { completeEuropePlayoff, completeEuropeQualifying } from "./competitions/worldcup/europe";
import {
  getIntercontinentalPlayoffRounds, recordIntercontinentalPlayoffRound
} from "./competitions/worldcup/intercontinental";
import {
  completeOceaniaPreliminary, completeOceaniaSecondRound, completeOceaniaThirdRound
} from "./competitions/worldcup/oceania";
import { completeSouthAmericaQualifying } from "./competitions/worldcup/southAmerica";
import { advanceWorldCupKnockout, startWorldCupRoundOf32 } from "./competitions/worldcup/tournament";
import { getWorldCupEdition } from "./competitions/worldcup/worldCup";
import { getWorldCupPathRound, recordWorldCupPathRound } from "./competitions/worldcup/utils";
import { addRoundToWindow } from "./lanes";
import { getWorldRanks } from "./rankings";
import type { InternationalRound, InternationalState, ScheduledRound, WindowRecord } from "./types";

/**
 * What happens once a round has been played: standings are completed, qualifying phases are
 * closed, and the next round of a knockout is drawn into the same lane of the window.
 */
export function onRoundPlayed(
  state: InternationalState,
  window: WindowRecord,
  round: ScheduledRound,
  awardTrophy: TrophyAwarder
): void {
  const handler = HANDLERS[round.kind ?? "friendly"];
  handler?.(state, window, round, awardTrophy);
}

/** Which of a nation's teams won a trophy: its senior matchday squad or its U20 squad. */
export type TrophyTeam = "senior" | "u20";

/** Gives a trophy to every player in a nation's squad for the given team. */
export type TrophyAwarder = (nationCode: string, trophy: string, team: TrophyTeam) => void;

type Handler = (state: InternationalState, window: WindowRecord, round: ScheduledRound, awardTrophy: TrophyAwarder) => void;

const addNext = (window: WindowRecord, next: InternationalRound | null): void => {
  if (next) addRoundToWindow(window, next);
};

// ---------------------------------------------------------------------------
// Tournaments (group stage + knockout rounds)
// ---------------------------------------------------------------------------

type KnockoutRoundIndexFinder = (edition: InternationalCompetitionEdition, round: ScheduledRound) => number;

const findKnockoutRoundIndex: KnockoutRoundIndexFinder = (edition, round) =>
  edition.knockout?.findIndex(knockoutRound =>
    knockoutRound.matches.some(knockoutMatch => round.matches.includes(knockoutMatch.fixture))
  ) ?? -1;

export interface TournamentRules {
  editions: (state: InternationalState) => InternationalCompetitionEdition[];
  editionId: (round: ScheduledRound) => string | undefined;
  stage: (round: ScheduledRound) => string | undefined;
  name: string;
  /** Name of the trophy won (shown on players' histories). */
  trophy: string;
  /** The winner's squad that receives the trophy. */
  team: TrophyTeam;
  afterGroup: (edition: InternationalCompetitionEdition) => InternationalRound | null;
  afterKnockout: (edition: InternationalCompetitionEdition, roundIndex: number) => InternationalRound | null;
}

export const TOURNAMENTS: Record<string, TournamentRules> = {
  goldCup: {
    name: "Gold Cup",
    trophy: "Gold Cup",
    team: "senior",
    editions: s => s.goldCup.editions,
    editionId: r => r.matches[0]?.goldCupEditionId,
    stage: r => r.matches[0]?.goldCupStage,
    afterGroup: edition => advanceInternationalCupRound(edition, -1),
    afterKnockout: (edition, index) => advanceInternationalCupRound(edition, index)
  },
  copaAmerica: {
    name: "Copa América",
    trophy: "Copa América",
    team: "senior",
    editions: s => s.copaAmerica.editions,
    editionId: r => r.matches[0]?.copaAmericaEditionId,
    stage: r => r.matches[0]?.copaAmericaStage,
    afterGroup: edition => advanceInternationalCupRound(edition, -1, "copaAmerica"),
    afterKnockout: (edition, index) => advanceInternationalCupRound(edition, index, "copaAmerica")
  },
  confedCup: {
    name: "Confederations Cup",
    trophy: "Confederations Cup",
    team: "senior",
    editions: s => s.confedCup.editions,
    editionId: r => r.matches[0]?.confedCupEditionId,
    stage: r => r.matches[0]?.confedCupStage,
    afterGroup: edition => advanceConfedCupRound(edition, -1),
    afterKnockout: (edition, index) => advanceConfedCupRound(edition, index)
  },
  u20WorldCup: {
    name: "U20 World Cup",
    trophy: "U20 World Cup",
    team: "u20",
    editions: s => s.u20WorldCup.editions,
    editionId: r => r.matches[0]?.u20WorldCupEditionId,
    stage: r => r.matches[0]?.u20WorldCupStage,
    afterGroup: edition => startTwentyFourTeamRoundOf16(edition, "u20WorldCup", "U20 World Cup"),
    afterKnockout: (edition, index) => advanceTwentyFourTeamKnockout(edition, index, "u20WorldCup", "U20 World Cup")
  },
  afcon: {
    name: "AFCON",
    trophy: "AFCON",
    team: "senior",
    editions: s => s.afcon.editions,
    editionId: r => r.matches[0]?.afconEditionId,
    stage: r => r.matches[0]?.afconStage,
    afterGroup: startAfconRoundOf16,
    afterKnockout: advanceAfconKnockoutRound
  },
  afcCup: {
    name: "Asian Cup",
    trophy: "Asian Cup",
    team: "senior",
    editions: s => s.afcCup.editions,
    editionId: r => r.matches[0]?.afcCupEditionId,
    stage: r => r.matches[0]?.afcCupStage,
    afterGroup: startAfcCupRoundOf16,
    afterKnockout: advanceAfcCupKnockoutRound
  },
  ofcCup: {
    name: "OFC Cup",
    trophy: "OFC Cup",
    team: "senior",
    editions: s => s.ofcCup.editions,
    editionId: r => r.matches[0]?.ofcCupEditionId,
    stage: r => r.matches[0]?.ofcCupStage,
    afterGroup: startOfcCupSemiFinals,
    afterKnockout: advanceOfcCupKnockoutRound
  },
  euro: {
    name: "EURO",
    trophy: "EURO",
    team: "senior",
    editions: s => s.euro.editions,
    editionId: r => r.matches[0]?.euroEditionId,
    stage: r => r.matches[0]?.euroStage,
    afterGroup: startEuroRoundOf16,
    afterKnockout: advanceEuroKnockoutRound
  }
};

function tournamentHandler(rules: TournamentRules): Handler {
  return (state, window, round, awardTrophy) => {
    const editionId = rules.editionId(round);
    if (!editionId) return;
    const edition = rules.editions(state).find(candidate => candidate.id === editionId);
    if (!edition) throw new Error(`Unknown ${rules.name} edition "${editionId}".`);

    const stage = rules.stage(round);
    if (stage === "group") addNext(window, rules.afterGroup(edition));
    else if (stage === "knockout") addNext(window, rules.afterKnockout(edition, findKnockoutRoundIndex(edition, round)));

    if (edition.completed && edition.winner && !edition.trophyAwarded) {
      edition.trophyAwarded = true;
      awardTrophy(edition.winner, rules.trophy, rules.team);
    }
  };
}

// ---------------------------------------------------------------------------
// Gold Cup playoff, AFCON / Asian Cup / OFC / EURO qualifying
// ---------------------------------------------------------------------------

function drawGoldCupAfterPlayoff(state: InternationalState, playoffId: string, year: number, windowId: string): void {
  const playoff = getGoldCupPlayoff(state.goldCup, playoffId);
  const tournamentWindow = findUpcomingWindow(year, windowId, (candidateYear, candidateDef) =>
    getGoldCupWindowType(candidateYear, candidateDef.id) === "GC"
  );
  if (!tournamentWindow) throw new Error(`No Gold Cup tournament window follows playoff "${playoffId}".`);
  createGoldCupEdition(
    state.goldCup, playoffId, playoff.directQualifiers,
    tournamentWindow.year, tournamentWindow.def.id, getWorldRanks(state)
  );
}

const goldCupPlayoff: Handler = (state, window, round) => {
  if (!round.label?.endsWith("Second leg")) return;
  const playoffId = round.matches[0]?.goldCupPlayoffId;
  if (!playoffId) return;
  completeGoldCupPlayoff(state.goldCup, playoffId);
  drawGoldCupAfterPlayoff(state, playoffId, window.year, window.windowId);
};

const afconQualifier: Handler = (state, window, round) => {
  const qualifierId = round.afconQualifierId;
  if (!qualifierId) return;
  const qualifier = getAfconQualifier(state.afcon, qualifierId);
  if (round.afconStage === "preliminary") {
    if (qualifier.preliminaryTies.every(tie => tie.winner !== null) && !qualifier.preliminaryComplete) {
      completeAfconPreliminary(state.afcon, qualifierId, window.year, window.windowId, getWorldRanks(state));
    }
  } else if (round.afconStage === "main") {
    qualifier.mainRoundsPlayed++;
    if (qualifier.mainRoundsPlayed === 6) {
      completeAfconMainQualifiers(state.afcon, qualifier.id, window.year, window.windowId, getWorldRanks(state));
    }
  }
};

const afcCupQualifier: Handler = (state, window, round) => {
  const qualifierId = round.afcCupQualifierId;
  if (!qualifierId) return;
  const qualifier = getAfcCupQualifier(state.afcCup, qualifierId);
  if (round.afcCupStage === "preliminary") {
    if (qualifier.preliminaryTies.every(tie => tie.winner !== null) && !qualifier.preliminaryComplete) {
      completeAfcCupPreliminary(state.afcCup, qualifierId, window.year, window.windowId, getWorldRanks(state));
    }
  } else if (round.afcCupStage === "main") {
    qualifier.mainRoundsPlayed++;
    if (qualifier.mainRoundsPlayed === 6) {
      completeAfcCupMainQualifiers(state.afcCup, qualifier.id, window.year, window.windowId, getWorldRanks(state));
    }
  }
};

const ofcCupQualifier: Handler = (state, window, round) => {
  if (!round.ofcCupQualifierId) return;
  const qualifier = getOfcCupQualifier(state.ofcCup, round.ofcCupQualifierId);
  qualifier.roundsPlayed++;
  if (qualifier.roundsPlayed === 10) {
    completeOfcCupQualifiers(state.ofcCup, qualifier.id, window.year, window.windowId, getWorldRanks(state));
  }
};

const euroQualifier: Handler = (state, window, round) => {
  if (!round.euroQualifierId) return;
  const qualifier = getEuroQualifyingEdition(state.euroQualifiers, round.euroQualifierId);

  if (round.euroStage === "qualifying") {
    qualifier.roundsPlayed++;
    if (qualifier.roundsPlayed === 10) {
      completeEuroMainQualifying(qualifier, state.nationsLeague.editions, getWorldRanks(state));
    }
  } else if (round.euroStage === "playoff") {
    const playoffsComplete = recordEuroPlayoffRound(qualifier, round.matches);
    if (!playoffsComplete && qualifier.playoffRoundsPlayed === 1) {
      addRoundToWindow(window, getEuroPlayoffFinalRound(qualifier, window.year, window.windowId));
    } else if (playoffsComplete) {
      const tournamentWindow = getNextCompetitionWindow(window.year, window.windowId, (year, id) =>
        getEuroWindowType(year, id) === "EURO"
      );
      createEuroEdition(
        state.euro,
        qualifier,
        qualifier.playoffPaths.map(path => {
          const final = path.bracket.rounds[1]?.[0];
          if (!final?.winner) throw new Error(`EURO playoff Path ${path.name} has no winner.`);
          return final.winner;
        }),
        tournamentWindow,
        getWorldRanks(state)
      );
    }
  }
};

// ---------------------------------------------------------------------------
// World Cup
// ---------------------------------------------------------------------------

const worldCupQualifier: Handler = (state, window, round) => {
  if (!round.worldCupEditionId || !round.worldCupPhase) return;
  const edition = getWorldCupEdition(state.worldCup, round.worldCupEditionId);
  edition.seedRanks = getWorldRanks(state);
  const phaseName = round.worldCupPhase;
  const region = phaseName === "ICPO"
    ? edition.intercontinental
    : Object.values(edition.regions).find(item => item.phases[phaseName]);
  const phase = region?.phases[phaseName];
  if (!phase) throw new Error(`Unknown World Cup qualifying phase "${phaseName}".`);

  if (phase.groups.length > 0) {
    phase.roundsPlayed++;
    const totalRounds = Math.max(...phase.groups.map(group => group.matches.length));
    if (phase.roundsPlayed < totalRounds) return;
    phase.completed = true;
    const completeGroupPhase: Record<string, () => void> = {
      SAWCQ: () => completeSouthAmericaQualifying(edition),
      CAFWCQ: () => completeAfricaQualifying(edition, window.year, window.windowId),
      CCWCQ2: () => completeConcacafSecondRound(edition),
      CCWCQ3: () => completeConcacafThirdRound(edition),
      AFCWCQ2: () => completeAsiaSecondRound(edition),
      AFCWCQ3: () => completeAsiaThirdRound(edition),
      OFCWCQ2: () => completeOceaniaSecondRound(edition, window.year, window.windowId),
      UEFAWCQM: () => completeEuropeQualifying(edition, state.nationsLeague.editions)
    };
    completeGroupPhase[phaseName]?.();
  } else if (phase.ties.length > 0 && round.worldCupRound === 2) {
    if (phase.ties.some(tie => tie.winner === null)) {
      throw new Error(`World Cup qualifying ties in ${phaseName} have not all completed.`);
    }
    phase.completed = true;
    const completeTiePhase: Record<string, () => void> = {
      CCWCQ1: () => completeConcacafPreliminary(edition),
      AFCWCQ1: () => completeAsiaPreliminary(edition),
      CAFWCQP: () => completeAfricaPlayoff(edition),
      OFCWCQ3: () => completeOceaniaThirdRound(edition)
    };
    completeTiePhase[phaseName]?.();
  } else if (phase.paths.length > 0) {
    const pathsComplete = phaseName === "ICPO"
      ? recordIntercontinentalPlayoffRound(edition, round.matches)
      : recordWorldCupPathRound(phase, round.matches);
    if (pathsComplete) {
      const completePathPhase: Record<string, () => void> = {
        OFCWCQ1: () => completeOceaniaPreliminary(edition),
        OFCWCQ3: () => completeOceaniaThirdRound(edition),
        CAFWCQP: () => completeAfricaPlayoff(edition),
        UEFAWCQP: () => completeEuropePlayoff(edition)
      };
      completePathPhase[phaseName]?.();
    } else {
      const next = phaseName === "ICPO"
        ? getIntercontinentalPlayoffRounds(edition, window.year, window.windowId)[0] ?? null
        : getWorldCupPathRound(phase, edition.id, phaseName, window.year, window.windowId);
      addNext(window, next);
    }
  }
};

const worldCupFinals: Handler = (state, window, round, awardTrophy) => {
  if (!round.worldCupEditionId || !round.worldCupStage) return;
  const edition = getWorldCupEdition(state.worldCup, round.worldCupEditionId);
  const tournament = edition.tournament;
  if (!tournament) return;

  if (round.worldCupStage === "group" && round.worldCupRound === 3) {
    addNext(window, startWorldCupRoundOf32(tournament));
  } else if (round.worldCupStage === "knockout") {
    const knockoutRoundIndex = tournament.knockout?.findIndex(knockoutRound =>
      knockoutRound.matches.some(knockoutMatch => round.matches.includes(knockoutMatch.fixture))
    ) ?? -1;
    addNext(window, advanceWorldCupKnockout(tournament, knockoutRoundIndex));
  }

  if (tournament.completed && tournament.winner && !tournament.trophyAwarded) {
    tournament.trophyAwarded = true;
    awardTrophy(tournament.winner, "World Cup", "senior");
  }
};

const HANDLERS: Record<string, Handler> = {
  goldCupPlayoff,
  goldCup: tournamentHandler(TOURNAMENTS.goldCup),
  copaAmerica: tournamentHandler(TOURNAMENTS.copaAmerica),
  confedCup: tournamentHandler(TOURNAMENTS.confedCup),
  u20WorldCup: tournamentHandler(TOURNAMENTS.u20WorldCup),
  afconQualifier,
  afcon: tournamentHandler(TOURNAMENTS.afcon),
  afcCupQualifier,
  afcCup: tournamentHandler(TOURNAMENTS.afcCup),
  ofcCupQualifier,
  ofcCup: tournamentHandler(TOURNAMENTS.ofcCup),
  euroQualifier,
  euro: tournamentHandler(TOURNAMENTS.euro),
  worldCupQualifier,
  worldCup: worldCupFinals
};
