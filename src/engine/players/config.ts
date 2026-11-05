/** Tunable settings for the player pool. */

/** Training facility rating (1-5) used when players develop each year. */
export const DEVELOPMENT_FACILITY_RATING = 3;

/** Newgens generated for every nation at the start of each season after the first. */
export const NEWGENS_PER_NATION = 11;
export const NEWGEN_AGE = 15;

/** Each season this many newgens (from the whole intake) become wonderkids. */
export const WONDERKIDS_PER_SEASON = 5;
export const WONDERKID_POTENTIAL_MIN = 92;
export const WONDERKID_POTENTIAL_MAX = 95;
/** A wonderkid's overall is this share of their potential. */
export const WONDERKID_OVERALL_SHARE_MIN = 0.6;
export const WONDERKID_OVERALL_SHARE_MAX = 0.7;
/** Newgens already above this potential are not eligible to be picked. */
export const WONDERKID_ELIGIBILITY_CEILING = 90;

/**
 * The newgen formula works on a 1-200 ability scale; players in this game are rated roughly 40-99.
 * Generated ability is mapped linearly onto [RATING_MIN, RATING_MAX]. Tune these to make newgens
 * stronger or weaker without touching the generation formula.
 */
export const RATING_MIN = 35;
export const RATING_MAX = 99;
export const ABILITY_MAX = 200;

/** Limits for players added in God Mode. */
export const PLAYER_AGE_MIN = 15;
export const PLAYER_AGE_MAX = 45;
export const MIN_PLAYER_RATING = 20;
export const MAX_PLAYER_RATING = 99;
