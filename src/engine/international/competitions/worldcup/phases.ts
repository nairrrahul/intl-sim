/**
 * Window types that belong to the World Cup (qualifying phases, intercontinental play-off, finals).
 * This is the existing World Cup phase configuration: stage identifiers on World Cup matches are validated against it.
 */
export const WORLD_CUP_WINDOW_TYPES: ReadonlySet<string> = new Set([
  "SAWCQ", "CAFWCQ", "CAFWCQP", "CCWCQ1", "CCWCQ2", "CCWCQ3",
  "AFCWCQ1", "AFCWCQ2", "AFCWCQ3", "OFCWCQ1", "OFCWCQ2", "OFCWCQ3",
  "UEFAWCQM", "UEFAWCQP", "ICPO", "WC"
]);

/** Phases that are only ever played as play-offs. */
export const WORLD_CUP_PLAYOFF_ONLY_PHASES: ReadonlySet<string> = new Set(["UEFAWCQP", "CAFWCQP", "ICPO"]);

/** Every phase a World Cup qualifying or play-off match can carry as its stage (everything but the finals). */
export const WORLD_CUP_QUALIFYING_PHASES: ReadonlySet<string> =
  new Set([...WORLD_CUP_WINDOW_TYPES].filter(type => type !== "WC"));
