import { getDistributedInternationalRoundSchedule } from "./calendar/windowCalendar";
import { createAfricaQualifying } from "./competitions/worldcup/africa";
import { createAsiaQualifying } from "./competitions/worldcup/asia";
import { createConcacafQualifying } from "./competitions/worldcup/concacaf";
import { createEuropeQualifying } from "./competitions/worldcup/europe";
import { createIntercontinentalPlayoff, getIntercontinentalPlayoffRounds } from "./competitions/worldcup/intercontinental";
import { createOceaniaQualifying } from "./competitions/worldcup/oceania";
import { createSouthAmericaQualifying } from "./competitions/worldcup/southAmerica";
import { createWorldCupTournament, getWorldCupGroupRounds } from "./competitions/worldcup/tournament";
import { ensureWorldCupEdition, getWorldCupSeasonForWindow, getWorldCupWindowType } from "./competitions/worldcup/worldCup";
import {
  createWorldCupGroupRounds, getWorldCupPathRound, getWorldCupTieRounds
} from "./competitions/worldcup/utils";
import { getWorldRanks } from "./rankings";
import type { WorldCupEdition, WorldCupPhase } from "./competitions/worldcup/types";
import type { WindowBuild } from "./windowBuilder";

const CONFEDERATIONS = ["UEFA", "CONCACAF", "CONMEBOL", "OFC", "AFC", "CAF"] as const;
type Confederation = typeof CONFEDERATIONS[number];
type RegionName = keyof WorldCupEdition["regions"];

/** Window types that belong to the World Cup (qualifying phases, intercontinental play-off, finals). */
export const WORLD_CUP_WINDOW_TYPES = new Set([
  "SAWCQ", "CAFWCQ", "CAFWCQP", "CCWCQ1", "CCWCQ2", "CCWCQ3",
  "AFCWCQ1", "AFCWCQ2", "AFCWCQ3", "OFCWCQ1", "OFCWCQ2", "OFCWCQ3",
  "UEFAWCQM", "UEFAWCQP", "ICPO", "WC"
]);

/**
 * Draws the World Cup finals from the qualified teams. When `validateField` is set the field must
 * be exactly 48 distinct nations.
 */
export function drawWorldCupFinals(
  edition: WorldCupEdition,
  year: number,
  worldRanks: Record<string, number>,
  validateField = false
): void {
  const uefaPlayoffWinners = edition.regions.UEFA.phases.UEFAWCQP?.qualifiers ?? [];
  const playoffSet = new Set(uefaPlayoffWinners);
  const direct = Object.values(edition.regions).flatMap(region =>
    region.qualified.filter(code => !playoffSet.has(code))
  );
  if (validateField) {
    const field = [...edition.hosts, ...direct, ...edition.intercontinental.qualified, ...uefaPlayoffWinners];
    if (field.length !== 48 || new Set(field).size !== 48) {
      throw new Error(`World Cup qualification completed with ${field.length} entries (${new Set(field).size} unique); expected 48.`);
    }
  }
  edition.tournament = createWorldCupTournament(
    year, edition.hosts, direct, edition.intercontinental.qualified, uefaPlayoffWinners, worldRanks
  );
}

/**
 * Adds this window's World Cup rounds (qualifying phases and/or the finals) to the build.
 * Returns the nations that have a World Cup *qualifying* fixture (they must not play friendlies).
 */
export function addWorldCupRounds(build: WindowBuild): Set<string> {
  const { state, year, windowId } = build;
  const types = Object.fromEntries(CONFEDERATIONS.map(confederation => [
    confederation, getWorldCupWindowType(confederation, year, windowId)
  ])) as Record<Confederation, string | null>;
  const activeTypes = Object.values(types).filter((type): type is string => type !== null && WORLD_CUP_WINDOW_TYPES.has(type));
  if (activeTypes.length === 0) return new Set();

  const edition = ensureWorldCupEdition(state.worldCup, getWorldCupSeasonForWindow(year, windowId), getWorldRanks(state));
  const roundsBefore = build.rounds.length;
  const teams: string[] = [];

  const regionOf = (regionName?: RegionName) => regionName ? edition.regions[regionName] : edition.intercontinental;

  const collectPhaseTeams = (phaseName: string, regionName?: RegionName): WorldCupPhase | null => {
    const phase = regionOf(regionName).phases[phaseName];
    if (!phase) return null;
    teams.push(
      ...phase.groups.flatMap(group => group.teams),
      ...phase.ties.flatMap(tie => [tie.team1, tie.team2]),
      ...phase.playoffTeams
    );
    return phase;
  };
  const requirePhase = (phaseName: string, regionName: RegionName): WorldCupPhase => {
    const phase = collectPhaseTeams(phaseName, regionName);
    if (!phase) throw new Error(`${regionName} World Cup phase ${phaseName} was not drawn.`);
    return phase;
  };

  const addGroups = (phaseName: string, regionName: RegionName) => {
    const phase = requirePhase(phaseName, regionName);
    const totalRounds = Math.max(...phase.groups.map(group => group.matches.length));
    const schedule = getDistributedInternationalRoundSchedule(regionName, phaseName, year, windowId, totalRounds);
    build.rounds.push(...createWorldCupGroupRounds(
      phase, edition.id, phaseName, "worldCupQualifier", year, windowId, schedule.count, totalRounds, schedule.start
    ));
  };
  const addTies = (phaseName: string, regionName: RegionName) => {
    const phase = requirePhase(phaseName, regionName);
    build.rounds.push(...getWorldCupTieRounds(phase, edition.id, phaseName, year, windowId));
  };
  const addPaths = (phaseName: string, regionName: RegionName) => {
    const phase = requirePhase(phaseName, regionName);
    const round = getWorldCupPathRound(phase, edition.id, phaseName, year, windowId);
    if (round) build.rounds.push(round);
  };
  /** Phases that are played as ties when the draw produced ties, or as play-off paths otherwise. */
  const addTiesOrPaths = (phaseName: string, regionName: RegionName, missingMessage: string) => {
    const phase = collectPhaseTeams(phaseName, regionName);
    if (!phase) throw new Error(missingMessage);
    if (phase.ties.length > 0) addTies(phaseName, regionName);
    else addPaths(phaseName, regionName);
  };
  const initialize = (regionName: RegionName, phaseName: string, create: () => void) => {
    if (!edition.regions[regionName].phases[phaseName]) create();
  };

  if (types.CONMEBOL === "SAWCQ") {
    initialize("CONMEBOL", "SAWCQ", () => createSouthAmericaQualifying(edition));
    addGroups("SAWCQ", "CONMEBOL");
  }
  if (types.CAF === "CAFWCQ") {
    initialize("CAF", "CAFWCQ", () => createAfricaQualifying(edition));
    addGroups("CAFWCQ", "CAF");
  }
  if (types.CAF === "CAFWCQP") {
    addTiesOrPaths("CAFWCQP", "CAF", "CAF World Cup playoff was not drawn after the main qualifying round.");
  }
  if (types.CONCACAF === "CCWCQ1") {
    initialize("CONCACAF", "CCWCQ1", () => createConcacafQualifying(edition, year, windowId));
    addTies("CCWCQ1", "CONCACAF");
  }
  if (types.CONCACAF === "CCWCQ2") addGroups("CCWCQ2", "CONCACAF");
  if (types.CONCACAF === "CCWCQ3") addGroups("CCWCQ3", "CONCACAF");
  if (types.AFC === "AFCWCQ1") {
    initialize("AFC", "AFCWCQ1", () => createAsiaQualifying(edition, year, windowId));
    addTies("AFCWCQ1", "AFC");
  }
  if (types.AFC === "AFCWCQ2") addGroups("AFCWCQ2", "AFC");
  if (types.AFC === "AFCWCQ3") addGroups("AFCWCQ3", "AFC");
  if (types.OFC === "OFCWCQ1") {
    initialize("OFC", "OFCWCQ1", () => createOceaniaQualifying(edition));
    addPaths("OFCWCQ1", "OFC");
  }
  if (types.OFC === "OFCWCQ2") addGroups("OFCWCQ2", "OFC");
  if (types.OFC === "OFCWCQ3") {
    addTiesOrPaths("OFCWCQ3", "OFC", "OFC third qualifying round was not drawn after the main round.");
  }
  if (types.UEFA === "UEFAWCQM") {
    initialize("UEFA", "UEFAWCQM", () => createEuropeQualifying(edition));
    addGroups("UEFAWCQM", "UEFA");
  }
  if (types.UEFA === "UEFAWCQP") addPaths("UEFAWCQP", "UEFA");

  const qualifyingFixtureTeams = () => new Set(build.rounds.slice(roundsBefore)
    .filter(round => round.kind === "worldCupQualifier")
    .flatMap(round => round.matches.flatMap(match => [match.home, match.away])));

  if (Object.values(types).includes("ICPO")) {
    if (!edition.intercontinental.phases.ICPO) createIntercontinentalPlayoff(edition, year, windowId);
    collectPhaseTeams("ICPO");
    build.rounds.push(...getIntercontinentalPlayoffRounds(edition, year, windowId));
  }
  if (Object.values(types).includes("WC")) {
    if (!edition.tournament) drawWorldCupFinals(edition, year, getWorldRanks(state));
    teams.push(...edition.tournament!.teams);
    build.rounds.push(...getWorldCupGroupRounds(edition.tournament!));
  }

  const fixtureTeams = qualifyingFixtureTeams();
  new Set(teams).forEach(code => build.busy.add(code));
  return fixtureTeams;
}
