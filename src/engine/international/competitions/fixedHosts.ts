import fixedCompetitionHostsRaw from "../data/intl_competition_hosts.json";

/** Hosts fixed in advance for specific competition editions (competition code -> year -> "A|B"). */
const fixedCompetitionHosts = fixedCompetitionHostsRaw as Record<string, Record<string, string>>;

export function getFixedInternationalCompetitionHosts(
  competition: string,
  year: number
): string[] | null {
  const configuredHosts = fixedCompetitionHosts[competition]?.[String(year)];
  if (!configuredHosts) return null;
  const hosts = configuredHosts.split("|");
  if (hosts.some(host => !host) || new Set(hosts).size !== hosts.length) {
    throw new Error(`Invalid fixed host configuration for ${competition} ${year}.`);
  }
  return hosts;
}

