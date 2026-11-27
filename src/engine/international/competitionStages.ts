import { WORLD_CUP_PLAYOFF_ONLY_PHASES, WORLD_CUP_QUALIFYING_PHASES } from "./competitions/worldcup/phases";
import type { CompetitionName, CompetitionOptions } from "./types";

/**
 * Application-side validation of match competition metadata.
 *
 * TypeScript only enforces the general shape of CompetitionOptions (one phase per match, no `leg` on finals, ...).
 * Which stage identifiers exist for which competition is checked here. The identifiers are exactly the ones the
 * competition engine already uses; the World Cup ones come straight from the existing World Cup phase configuration.
 */
export type CompetitionPhase = "qualifying" | "playoff" | "finals";

const GROUP_AND_KNOCKOUT: readonly string[] = ["group", "knockout"];

const STAGES: Record<CompetitionName, Partial<Record<CompetitionPhase, ReadonlySet<string>>>> = {
  goldCup: { playoff: new Set(["playoff"]), finals: new Set(GROUP_AND_KNOCKOUT) },
  copaAmerica: { finals: new Set(GROUP_AND_KNOCKOUT) },
  confedCup: { finals: new Set(GROUP_AND_KNOCKOUT) },
  u20WorldCup: { finals: new Set(GROUP_AND_KNOCKOUT) },
  u20Qualifier: { qualifying: new Set(["group", "tie"]), playoff: new Set(["playoff"]) },
  afcon: { qualifying: new Set(["preliminary", "main"]), finals: new Set(GROUP_AND_KNOCKOUT) },
  afcCup: { qualifying: new Set(["preliminary", "main"]), finals: new Set(GROUP_AND_KNOCKOUT) },
  ofcCup: { qualifying: new Set(["qualifying"]), finals: new Set(GROUP_AND_KNOCKOUT) },
  euro: { qualifying: new Set(["qualifying"]), playoff: new Set(["playoff"]), finals: new Set(GROUP_AND_KNOCKOUT) },
  worldCup: {
    qualifying: WORLD_CUP_QUALIFYING_PHASES,
    playoff: WORLD_CUP_QUALIFYING_PHASES,
    finals: new Set(GROUP_AND_KNOCKOUT)
  }
};

/** The single phase a competition record is in, or null if it is in none or several (invalid). */
export function getCompetitionPhase(info: CompetitionOptions): CompetitionPhase | null {
  const phases: CompetitionPhase[] = [];
  if (info.qualifyingInfo) phases.push("qualifying");
  if (info.playoffOptions) phases.push("playoff");
  if (info.finalsInfo) phases.push("finals");
  return phases.length === 1 ? phases[0] : null;
}

/** Every problem found with a match's competition metadata (empty when it is valid). */
export function validateCompetitionInformation(info: CompetitionOptions): string[] {
  const problems: string[] = [];
  const phase = getCompetitionPhase(info);
  const stages = STAGES[info.competitionName];
  if (!stages) return [`unknown competition "${info.competitionName}"`];
  if (!Number.isInteger(info.tournamentYear)) problems.push(`tournament year "${info.tournamentYear}" is not a year`);
  if (phase === null) {
    problems.push("a match must belong to exactly one of qualifying, playoff or finals");
    return problems;
  }

  const details = info.qualifyingInfo ?? info.playoffOptions ?? info.finalsInfo!;
  const allowed = stages[phase];
  if (!allowed) problems.push(`${info.competitionName} has no ${phase} matches`);
  else if (!allowed.has(details.stage)) problems.push(`"${details.stage}" is not a ${info.competitionName} ${phase} stage`);

  if (info.competitionName === "worldCup" && phase !== "finals") {
    const playoffOnly = WORLD_CUP_PLAYOFF_ONLY_PHASES.has(details.stage);
    if (playoffOnly && phase !== "playoff") problems.push(`"${details.stage}" matches are playoff matches`);
  }
  if (phase === "finals" && "leg" in details) problems.push("finals matches are single-legged and cannot carry a leg");
  if (phase !== "finals") {
    const tied = details as { tieId?: string; leg?: number };
    if (tied.leg !== undefined && tied.leg !== 1 && tied.leg !== 2) problems.push(`leg "${tied.leg}" must be 1 or 2`);
    if (tied.leg !== undefined && tied.tieId === undefined) problems.push("a leg needs the tie it belongs to");
  }
  return problems;
}

/** Throws when a match's competition metadata is invalid. */
export function assertValidCompetitionInformation(info: CompetitionOptions): void {
  const problems = validateCompetitionInformation(info);
  if (problems.length > 0) {
    throw new Error(`Invalid ${info.competitionName} match metadata: ${problems.join("; ")}.`);
  }
}
