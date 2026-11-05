import { getNationsLeagueConfederations } from "../engine/international/competitions/nationsLeague";

/** A page in the sidebar's international-competitions group. */
export interface CompetitionLink {
  label: string;
  to: string;
  /** Extra words that make the page findable in the global search. */
  keywords: string;
}

/** A parent competition and the pages that belong to it (shown as one visually separated block). */
export interface CompetitionSection {
  id: string;
  title: string;
  links: CompetitionLink[];
}

const WORLD_CUP_QUALIFYING_CONFEDERATIONS = ["UEFA", "CONCACAF", "CONMEBOL", "OFC", "AFC", "CAF"] as const;

/** Every international competition page, grouped by parent competition. */
export function getCompetitionSections(): CompetitionSection[] {
  return [
    {
      id: "world-cup",
      title: "FIFA World Cup",
      links: [
        { label: "World Cup", to: "/world-cup", keywords: "fifa world cup" },
        ...WORLD_CUP_QUALIFYING_CONFEDERATIONS.map(confederation => ({
          label: `${confederation} Qualifiers`,
          to: `/world-cup-qualifiers/${confederation}`,
          keywords: `world cup qualifiers ${confederation.toLowerCase()}`
        })),
        {
          label: "Intercontinental Playoff",
          to: "/world-cup-intercontinental-playoff",
          keywords: "world cup intercontinental playoff icpo"
        }
      ]
    },
    {
      id: "euro",
      title: "UEFA EURO",
      links: [
        { label: "UEFA EURO", to: "/euro", keywords: "uefa euro european championship euros" },
        { label: "EURO Qualifiers", to: "/euro-qualifiers", keywords: "euro qualifiers playoff" }
      ]
    },
    {
      id: "copa-america",
      title: "Copa América",
      links: [{ label: "Copa América", to: "/copa-america", keywords: "copa america conmebol" }]
    },
    {
      id: "u20-world-cup",
      title: "U20 World Cup",
      links: [{ label: "U20 World Cup", to: "/u20-world-cup", keywords: "u20 world cup youth under 20" }]
    },
    {
      id: "confederations-cup",
      title: "Confederations Cup",
      links: [{ label: "Confederations Cup", to: "/confederations-cup", keywords: "confederations cup confed champions" }]
    },
    {
      id: "afcon",
      title: "Africa Cup of Nations",
      links: [
        { label: "AFCON", to: "/afcon", keywords: "africa cup of nations caf" },
        { label: "AFCON Qualifiers", to: "/afcon-qualifiers", keywords: "afcon qualifiers caf" }
      ]
    },
    {
      id: "afc-cup",
      title: "AFC Asian Cup",
      links: [
        { label: "Asian Cup", to: "/afc-cup", keywords: "afc cup asian cup" },
        { label: "Asian Cup Qualifiers", to: "/afc-cup-qualifiers", keywords: "afc cup qualifiers" }
      ]
    },
    {
      id: "gold-cup",
      title: "CONCACAF Gold Cup",
      links: [
        { label: "Gold Cup", to: "/gold-cup", keywords: "gold cup concacaf" },
        { label: "Gold Cup Playoff", to: "/gold-cup-playoff", keywords: "gold cup playoff qualifier concacaf" }
      ]
    },
    {
      id: "ofc-cup",
      title: "OFC Nations Cup",
      links: [
        { label: "OFC Cup", to: "/ofc-cup", keywords: "ofc oceania cup" },
        { label: "OFC Cup Qualifiers", to: "/ofc-cup-qualifiers", keywords: "ofc cup qualifiers" }
      ]
    },
    {
      id: "nations-league",
      title: "Nations League",
      links: getNationsLeagueConfederations().map(confederation => ({
        label: `${confederation} Nations League`,
        to: `/nations-league/${confederation}`,
        keywords: `nations league ${confederation.toLowerCase()}`
      }))
    }
  ];
}

/** Display name of the competition a match kind belongs to (null for friendlies). */
const COMPETITION_NAME_BY_KIND: Record<string, string> = {
  nationsLeague: "Nations League",
  goldCupPlayoff: "Gold Cup Playoff",
  goldCupGroup: "Gold Cup", goldCupKnockout: "Gold Cup",
  copaAmericaGroup: "Copa América", copaAmericaKnockout: "Copa América",
  confedCupGroup: "Confederations Cup", confedCupKnockout: "Confederations Cup",
  u20WorldCupGroup: "U20 World Cup", u20WorldCupKnockout: "U20 World Cup",
  afconQualifier: "AFCON Qualifiers", afconGroup: "AFCON", afconKnockout: "AFCON",
  afcCupQualifier: "Asian Cup Qualifiers", afcCupGroup: "Asian Cup", afcCupKnockout: "Asian Cup",
  ofcCupQualifier: "OFC Cup Qualifiers", ofcCupGroup: "OFC Cup", ofcCupKnockout: "OFC Cup",
  euroQualifier: "EURO Qualifiers", euroGroup: "UEFA EURO", euroKnockout: "UEFA EURO",
  worldCupQualifier: "World Cup Qualifiers", worldCupGroup: "World Cup", worldCupKnockout: "World Cup"
};

export function getCompetitionNameForKind(kind: string): string {
  if (kind === "friendly") return "Friendly";
  return COMPETITION_NAME_BY_KIND[kind] ?? kind;
}
