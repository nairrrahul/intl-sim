import teamBansRaw from "../data/team_bans.json";

/** Nations banned from competitive matches until a given season year. */
const teamBanYears = teamBansRaw as Record<string, number>;

export function isInternationalTeamCompetitivelyEligible(code: string, seasonYear: number): boolean {
  const banYear = teamBanYears[code];
  return banYear === undefined || seasonYear >= banYear;
}

export function getCompetitivelyEligibleTeams(teams: string[], seasonYear: number): string[] {
  return teams.filter(code => isInternationalTeamCompetitivelyEligible(code, seasonYear));
}

