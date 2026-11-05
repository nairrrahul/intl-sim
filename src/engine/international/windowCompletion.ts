import { findUpcomingWindow } from "./calendar/windows";
import { getNextCompetitionWindow } from "./calendar/windowCalendar";
import { createCopaAmericaEdition } from "./competitions/copaAmerica";
import { createEuroQualifyingEdition, findEuroQualifyingEdition, getEuroWindowType } from "./competitions/euroQualifiers";
import { completeNationsLeagueEditions } from "./competitions/nationsLeague";
import { createU20WorldCupEdition, findU20WorldCupEdition, getU20WorldCupWindowType } from "./competitions/u20WorldCup";
import { createOfcCupQualifierEdition, findOfcCupQualifier, getOfcCupWindowType } from "./competitions/ofcCup";
import { getInternationalWindowType } from "./calendar/windowCalendar";
import { createAfricaQualifying } from "./competitions/worldcup/africa";
import { createAsiaQualifying } from "./competitions/worldcup/asia";
import { createConcacafQualifying } from "./competitions/worldcup/concacaf";
import { createEuropeQualifying } from "./competitions/worldcup/europe";
import { createIntercontinentalPlayoff } from "./competitions/worldcup/intercontinental";
import { createOceaniaQualifying } from "./competitions/worldcup/oceania";
import { createSouthAmericaQualifying } from "./competitions/worldcup/southAmerica";
import type { WorldCupEdition } from "./competitions/worldcup/types";
import {
  ensureWorldCupEdition, getWorldCupSeasonForWindow, getWorldCupWindowType
} from "./competitions/worldcup/worldCup";
import { computeRankings, getWorldRanks } from "./rankings";
import { drawWorldCupFinals } from "./worldCupWindow";
import type { InternationalState, WindowRecord } from "./types";

const CONFEDERATIONS = ["UEFA", "CONCACAF", "CONMEBOL", "OFC", "AFC", "CAF"] as const;

/** The Copa América is drawn two windows ahead, once the Gold Cup field is known. */
function drawCopaAmericaIfDue(state: InternationalState, year: number, windowId: string): void {
  const tournamentWindow = findUpcomingWindow(year, windowId, (candidateYear, candidateDef) =>
    getInternationalWindowType("CONMEBOL", candidateYear, candidateDef.id) === "COPA"
  );
  if (!tournamentWindow || tournamentWindow.offset !== 2) return;
  if (state.copaAmerica.editions.some(edition =>
    edition.year === tournamentWindow.year && edition.windowId === tournamentWindow.def.id
  )) return;

  createCopaAmericaEdition(
    state.copaAmerica, state.goldCup, tournamentWindow.year, tournamentWindow.def.id, getWorldRanks(state)
  );
}

/** Draws the OFC Cup qualifying competition one window before it begins. */
function drawOfcCupQualifyingIfNext(state: InternationalState, window: WindowRecord): void {
  const upcoming = findUpcomingWindow(window.year, window.windowId, (year, def) =>
    getOfcCupWindowType(year, def.id) === "OFCCUPQ"
  );
  if (!upcoming || upcoming.offset !== 1 || findOfcCupQualifier(state.ofcCup, upcoming.year)) return;

  const tournamentWindow = getNextCompetitionWindow(
    upcoming.year, upcoming.def.id, (year, id) => getOfcCupWindowType(year, id) === "OFCCUP"
  );
  createOfcCupQualifierEdition(state.ofcCup, upcoming.year, tournamentWindow.year, getWorldRanks(state));
}

/** Draws the EURO qualifying groups one window before they begin. */
function drawEuroQualifyingIfNext(state: InternationalState, window: WindowRecord): void {
  const upcoming = findUpcomingWindow(window.year, window.windowId, (year, def) =>
    getEuroWindowType(year, def.id) === "EUROQ"
  );
  if (!upcoming || upcoming.offset !== 1) return;

  const tournamentWindow = getNextCompetitionWindow(
    upcoming.year, upcoming.def.id, (year, id) => getEuroWindowType(year, id) === "EURO"
  );
  if (findEuroQualifyingEdition(state.euroQualifiers, tournamentWindow.year)) return;

  const previousHosts = [...state.euro.editions].sort((a, b) => b.year - a.year)[0]?.hosts ?? [];
  createEuroQualifyingEdition(
    state.euroQualifiers,
    tournamentWindow.year,
    getWorldRanks(state),
    { year: window.year, windowId: window.windowId },
    previousHosts
  );
}

/** Draws the U20 World Cup (field, host, groups and fixtures) in the window before it is played. */
function drawU20WorldCupIfNext(state: InternationalState, window: WindowRecord): void {
  const upcoming = findUpcomingWindow(window.year, window.windowId, (year, def) =>
    getU20WorldCupWindowType(year, def.id) === "U20"
  );
  if (!upcoming || upcoming.offset !== 1) return;
  if (findU20WorldCupEdition(state.u20WorldCup, upcoming.year, upcoming.def.id)) return;
  createU20WorldCupEdition(state, upcoming.year, upcoming.def.id);
}

function worldCupQualifyingComplete(edition: WorldCupEdition): boolean {
  const { CONMEBOL, CAF, CONCACAF, AFC, OFC, UEFA } = edition.regions;
  const requiredPhases = [
    CONMEBOL.phases.SAWCQ, CAF.phases.CAFWCQ, CAF.phases.CAFWCQP,
    CONCACAF.phases.CCWCQ1, CONCACAF.phases.CCWCQ2, CONCACAF.phases.CCWCQ3,
    AFC.phases.AFCWCQ1, AFC.phases.AFCWCQ2, AFC.phases.AFCWCQ3,
    OFC.phases.OFCWCQ1, OFC.phases.OFCWCQ2, OFC.phases.OFCWCQ3,
    UEFA.phases.UEFAWCQM, UEFA.phases.UEFAWCQP
  ];
  const intercontinental = edition.intercontinental.phases.ICPO;
  return requiredPhases.every(phase => phase?.completed) &&
    intercontinental?.completed === true && intercontinental.playoffComplete;
}

/** Draws World Cup qualifying phases (and the finals) one window before they begin. */
function drawWorldCupPhasesIfNext(state: InternationalState, window: WindowRecord): void {
  for (const confederation of CONFEDERATIONS) {
    const upcoming = findUpcomingWindow(window.year, window.windowId, (year, def) =>
      getWorldCupWindowType(confederation, year, def.id) !== null
    );
    if (!upcoming || upcoming.offset !== 1) continue;
    const type = getWorldCupWindowType(confederation, upcoming.year, upcoming.def.id);
    if (!type) continue;

    const edition = ensureWorldCupEdition(
      state.worldCup, getWorldCupSeasonForWindow(upcoming.year, upcoming.def.id), getWorldRanks(state)
    );
    const { regions, intercontinental } = edition;
    const windowId = upcoming.def.id;

    if (type === "SAWCQ" && !regions.CONMEBOL.phases.SAWCQ) createSouthAmericaQualifying(edition);
    else if (type === "CAFWCQ" && !regions.CAF.phases.CAFWCQ) createAfricaQualifying(edition);
    else if (type === "CCWCQ1" && !regions.CONCACAF.phases.CCWCQ1) createConcacafQualifying(edition, upcoming.year, windowId);
    else if (type === "AFCWCQ1" && !regions.AFC.phases.AFCWCQ1) createAsiaQualifying(edition, upcoming.year, windowId);
    else if (type === "OFCWCQ1" && !regions.OFC.phases.OFCWCQ1) createOceaniaQualifying(edition);
    else if (type === "UEFAWCQM" && !regions.UEFA.phases.UEFAWCQM) createEuropeQualifying(edition);
    else if (type === "ICPO" && !intercontinental.phases.ICPO) createIntercontinentalPlayoff(edition, upcoming.year, windowId);
    else if (type === "WC" && !edition.tournament) {
      if (!worldCupQualifyingComplete(edition)) continue;
      drawWorldCupFinals(edition, upcoming.year, getWorldRanks(state), true);
    }
  }
}

/**
 * Closes a window once its last matchday is played: marks it played, finishes Nations League
 * editions, records the rankings, and draws competitions that start in the following window.
 */
export function completeWindow(state: InternationalState, window: WindowRecord): void {
  drawCopaAmericaIfDue(state, window.year, window.windowId);
  window.status = "played";
  completeNationsLeagueEditions(state.nationsLeague);
  state.rankingHistory.push({
    year: window.year,
    windowId: window.windowId,
    label: window.label,
    ranks: computeRankings(state).map(row => [row.code, row.points] as [string, number])
  });
  drawOfcCupQualifyingIfNext(state, window);
  drawEuroQualifyingIfNext(state, window);
  drawU20WorldCupIfNext(state, window);
  drawWorldCupPhasesIfNext(state, window);
}
