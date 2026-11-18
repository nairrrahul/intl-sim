/** Individual awards are stored as trophies named "<Competition> Golden Boot". */
export const GOLDEN_BOOT_SUFFIX = "Golden Boot";

export const goldenBootName = (competition: string): string => `${competition} ${GOLDEN_BOOT_SUFFIX}`;

export const isGoldenBoot = (trophy: string): boolean => trophy.endsWith(GOLDEN_BOOT_SUFFIX);