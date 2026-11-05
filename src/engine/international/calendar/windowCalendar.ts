import teamWindowsRaw from "../data/team_windows.csv?raw";
import windowsRaw from "../data/international_windows.json";
import { SEASON_START_YEAR } from "../../config";

/**
 * The international calendar: six windows per year on a four-year (24-window) cycle.
 * team_windows.csv assigns every confederation a window type for each slot of the cycle.
 */

export type InternationalWindowType =
  | "FR" | "NL1" | "NL2" | "GCPO" | "GC" | "COPA"
  | "CAFQP1" | "CAFQP2" | "CAFQM1" | "CAFQM2" | "AFCON1" | "AFCON2"
  | "AFCQP" | "AFCQM" | "AFCCUP" | "OFCCUPQ" | "OFCCUP" | "EUROQ" | "EUROQP" | "EURO"
  | "SAWCQ" | "CAFWCQ" | "CAFWCQP" | "CCWCQ1" | "CCWCQ2" | "CCWCQ3"
  | "AFCWCQ1" | "AFCWCQ2" | "AFCWCQ3" | "OFCWCQ1" | "OFCWCQ2" | "OFCWCQ3"
  | "UEFAWCQM" | "UEFAWCQP" | "ICPO" | "WC";
export const INTERNATIONAL_CYCLE_WINDOW_COUNT = 24;

export function getDistributedInternationalRoundSchedule(
  confederation: string,
  competitionType: string,
  year: number,
  windowId: string,
  totalRounds: number
): { start: number; count: number } {
  if (!Number.isInteger(totalRounds) || totalRounds < 0) {
    throw new Error(`Invalid matchday count for ${confederation} ${competitionType}: ${totalRounds}.`);
  }
  const cycleIndex = ((getInternationalWindowIndex(year, windowId) % INTERNATIONAL_CYCLE_WINDOW_COUNT) +
    INTERNATIONAL_CYCLE_WINDOW_COUNT) % INTERNATIONAL_CYCLE_WINDOW_COUNT;
  const slots = Array.from({ length: INTERNATIONAL_CYCLE_WINDOW_COUNT }, (_, index) => index)
    .filter(index => getInternationalWindowTypeAt(confederation, index) === competitionType);
  const slotIndex = slots.indexOf(cycleIndex);
  if (slotIndex < 0) {
    throw new Error(`${confederation} ${competitionType} is not scheduled in ${year} ${windowId}.`);
  }
  const start = Math.round(slotIndex * totalRounds / slots.length);
  const end = Math.round((slotIndex + 1) * totalRounds / slots.length);
  return { start, count: end - start };
}

const WINDOW_COUNT_PER_YEAR = 6;
const CYCLE_WINDOW_COUNT = INTERNATIONAL_CYCLE_WINDOW_COUNT;

function parseTeamWindows(csv: string): Map<string, InternationalWindowType[]> {
  const rows = csv.trim().split(/\r?\n/).map(line => line.split(",").map(cell => cell.trim()));
  const parsed = new Map<string, InternationalWindowType[]>();
  for (const [rowIndex, [confederation, ...values]] of rows.entries()) {
    if (!confederation || values.length !== CYCLE_WINDOW_COUNT) {
      throw new Error(`team_windows.csv row ${rowIndex + 1} must contain a confederation and 24 window types.`);
    }
    const types = values.map(value => {
      if (value !== "FR" && value !== "NL1" && value !== "NL2" &&
        !/^GCPO[12]?$/.test(value) && !/^GC[12]?$/.test(value) && value !== "COPA" &&
        !/^(CAFQP|CAFQM|AFCON)[12]$/.test(value) &&
        value !== "AFCQP" && value !== "AFCQM" && value !== "AFCCUP" &&
        value !== "OFCCUPQ" && value !== "OFCCUP" &&
        value !== "EUROQ" && value !== "EUROQP" && value !== "EURO" &&
        !/^(SAWCQ|CAFWCQ|CAFWCQP|CCWCQ[123]|AFCWCQ[123]|OFCWCQ[123]|UEFAWCQM|UEFAWCQP|ICPO|WC)$/.test(value)) {
        throw new Error(`Unknown team_windows.csv window type "${value}" for ${confederation}.`);
      }
      if (value.startsWith("GCPO")) return "GCPO";
      if (value.startsWith("GC")) return "GC";
      return value as InternationalWindowType;
    });
    if (parsed.has(confederation)) throw new Error(`team_windows.csv contains duplicate ${confederation} rows.`);
    parsed.set(confederation, types);
  }
  if (parsed.size === 0) throw new Error("team_windows.csv does not define any confederations.");
  return parsed;
}

const teamWindows = parseTeamWindows(teamWindowsRaw);
const internationalWindowLabels = new Map(
  (windowsRaw as { windows: { id: string; label: string }[] }).windows.map(window => [window.id, window.label])
);

const internationalNames: Record<string, string> = {
  "AFCON 1": "African Cup of Nations",
  "AFCON 2": "African Cup of Nations",
  AFCON1: "African Cup of Nations",
  AFCON2: "African Cup of Nations",
  SAWCQ: "World Cup South American Qualifying",
  CAFWCQ: "World Cup African Qualifying",
  CAFWCQP: "World Cup African Play-off",
  CCWCQ1: "World Cup CONCACAF Preliminary Round",
  CCWCQ2: "World Cup CONCACAF Second Round",
  CCWCQ3: "World Cup CONCACAF Third Round",
  AFCWCQ1: "World Cup Asian Preliminary Round",
  AFCWCQ2: "World Cup Asian Second Round",
  AFCWCQ3: "World Cup Asian Third Round",
  OFCWCQ1: "World Cup OFC Preliminary Round",
  OFCWCQ2: "World Cup OFC Second Round",
  OFCWCQ3: "World Cup OFC Third Round",
  UEFAWCQM: "World Cup European Qualifying",
  UEFAWCQP: "World Cup European Qualifying Play-off",
  ICPO: "World Cup Intercontinental Play-off",
  WC: "World Cup"
};

export function getInternationalWindowLabel(windowId: string): string {
  return internationalWindowLabels.get(windowId) ?? windowId;
}

export function getInternationalDisplayName(value: string): string {
  const exact = internationalNames[value];
  if (exact) return exact;
  const prefixed = /^([A-Z0-9 ]+)( · .+)$/.exec(value);
  return prefixed ? `${internationalNames[prefixed[1]] ?? prefixed[1]}${prefixed[2]}` : value;
}

export function assertInternationalWindowCoverage(confederations: string[]): void {
  for (const confederation of confederations) {
    if (!teamWindows.has(confederation)) throw new Error(`team_windows.csv is missing the ${confederation} row.`);
  }
}

function windowNumber(windowId: string): number {
  const match = /^IW([1-6])$/.exec(windowId);
  if (!match) throw new Error(`Unknown international window ID "${windowId}".`);
  return Number(match[1]) - 1;
}

export function getInternationalWindowIndex(year: number, windowId: string): number {
  return (year - SEASON_START_YEAR) * WINDOW_COUNT_PER_YEAR + windowNumber(windowId);
}

export function getInternationalWindowLocation(index: number): { year: number; windowId: string } {
  const yearOffset = Math.floor(index / WINDOW_COUNT_PER_YEAR);
  const window = ((index % WINDOW_COUNT_PER_YEAR) + WINDOW_COUNT_PER_YEAR) % WINDOW_COUNT_PER_YEAR;
  return { year: SEASON_START_YEAR + yearOffset, windowId: `IW${window + 1}` };
}

export function getInternationalWindowTypeAt(confederation: string, index: number): InternationalWindowType {
  const types = teamWindows.get(confederation);
  if (!types) throw new Error(`No team-window schedule is configured for ${confederation}.`);
  const cycleIndex = ((index % CYCLE_WINDOW_COUNT) + CYCLE_WINDOW_COUNT) % CYCLE_WINDOW_COUNT;
  return types[cycleIndex];
}

export function getInternationalWindowType(
  confederation: string,
  year: number,
  windowId: string
): InternationalWindowType {
  return getInternationalWindowTypeAt(confederation, getInternationalWindowIndex(year, windowId));
}

export function getNextCompetitionWindow(
  year: number,
  windowId: string,
  predicate: (year: number, windowId: string) => boolean
): { year: number; windowId: string } {
  const currentIndex = getInternationalWindowIndex(year, windowId);
  for (let offset = 1; offset <= CYCLE_WINDOW_COUNT; offset++) {
    const index = currentIndex + offset;
    const location = getInternationalWindowLocation(index);
    if (!predicate(location.year, location.windowId)) continue;
    return location;
  }
  throw new Error(`No matching international competition window follows ${year} ${windowId}.`);
}

