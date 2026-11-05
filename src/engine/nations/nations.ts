import nationInfoRaw from "./data/nation_info.json";

export interface NationInfo {
  confederationID: string;
  flagCode: string;
  threeLetterCode: string;
  youthRating: number;
  rankingPts: number;
}

export const nationInfo = nationInfoRaw as unknown as Record<string, NationInfo>;

const nameByCode = new Map<string, string>(
  Object.entries(nationInfo).map(([name, info]) => [info.threeLetterCode, name])
);

const confederationByCode = new Map<string, string>(
  Object.values(nationInfo).map(info => [info.threeLetterCode, info.confederationID])
);

const flagByCode = new Map<string, string>(
  Object.values(nationInfo).map(info => [info.threeLetterCode, info.flagCode])
);

/** flag-icons code (e.g. "gb-eng") for a three-letter nation code, or null if unknown. */
export function getFlagCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return flagByCode.get(code) ?? null;
}

export function getConfederation(code: string): string | null {
  return confederationByCode.get(code) ?? null;
}

export function getNationName(code: string | null | undefined): string {
  if (!code) return "-";
  return nameByCode.get(code) ?? code;
}

export function getNationCodeByName(name: string): string | null {
  return nationInfo[name]?.threeLetterCode ?? null;
}

/** The youth rating a nation starts a new world with (0-200 scale). */
export function getInitialYouthRating(code: string): number {
  const info = Object.values(nationInfo).find(candidate => candidate.threeLetterCode === code);
  return info?.youthRating ?? 0;
}

export function getAllNationCodes(): string[] {
  return Object.values(nationInfo).map(info => info.threeLetterCode);
}

export function isValidNationCode(code: string): boolean {
  return nameByCode.has(code.toUpperCase());
}

export const REGIONS: { id: string; label: string }[] = [
  { id: "UEFA", label: "Europe (UEFA)" },
  { id: "CONMEBOL", label: "South America (CONMEBOL)" },
  { id: "CONCACAF", label: "North & Central America, Caribbean (CONCACAF)" },
  { id: "CAF", label: "Africa (CAF)" },
  { id: "AFC", label: "Asia (AFC)" },
  { id: "OFC", label: "Oceania (OFC)" }
];

export function getCountriesByRegion(regionId: string): { code: string; name: string }[] {
  return Object.entries(nationInfo)
    .filter(([, info]) => info.confederationID === regionId)
    .map(([name, info]) => ({ code: info.threeLetterCode, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
