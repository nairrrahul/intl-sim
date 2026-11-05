import { getPlayerName } from "../engine/players/display";
import type { Game } from "../engine/game";
import { nationInfo } from "../engine/nations/nations";
import { computeRankings } from "../engine/international/rankings";
import { getCompetitionSections } from "./competitions";
import { normalizeText } from "./format";

export interface SearchResult {
  kind: "player" | "nation" | "competition";
  key: string;
  label: string;
  sub: string;
  to: string;
}

const PER_KIND = 8;

const startsWithQuery = (query: string) => (a: SearchResult, b: SearchResult): number => {
  const aStarts = normalizeText(a.label).startsWith(query) ? 0 : 1;
  const bStarts = normalizeText(b.label).startsWith(query) ? 0 : 1;
  return aStarts - bStarts || a.label.localeCompare(b.label);
};

function searchPlayers(game: Game, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const player of game.world.players) {
    const name = getPlayerName(player);
    if (!normalizeText(`${name} ${player.firstName} ${player.lastName}`).includes(query)) continue;
    results.push({
      kind: "player",
      key: `p-${player.id}`,
      label: name,
      sub: `${player.isRetired ? "Retired · " : ""}${player.position} · OVR ${player.overall} · ${player.primaryNationality}`,
      to: `/player/${encodeURIComponent(player.id)}`
    });
    if (results.length >= PER_KIND) break;
  }
  return results;
}

function searchNations(game: Game, query: string): SearchResult[] {
  const rankOf = new Map(computeRankings(game.world.international).map(row => [row.code, row.rank]));
  return Object.entries(nationInfo)
    .filter(([name, info]) => normalizeText(`${name} ${info.threeLetterCode}`).includes(query))
    .map(([name, info]): SearchResult => ({
      kind: "nation",
      key: `n-${info.threeLetterCode}`,
      label: name,
      sub: `National team · ${info.confederationID} · world rank #${rankOf.get(info.threeLetterCode) ?? "-"}`,
      to: `/nation/${info.threeLetterCode}`
    }))
    .sort(startsWithQuery(query));
}

function searchCompetitions(query: string): SearchResult[] {
  return getCompetitionSections()
    .flatMap(section => section.links.map(link => ({ section, link })))
    .filter(({ section, link }) => normalizeText(`${link.label} ${section.title} ${link.keywords}`).includes(query))
    .map(({ section, link }): SearchResult => ({
      kind: "competition",
      key: `c-${link.to}`,
      label: link.label,
      sub: `International · ${section.title}`,
      to: link.to
    }));
}

export function runSearch(game: Game, rawQuery: string): SearchResult[] {
  const query = normalizeText(rawQuery.trim());
  if (query.length === 0) return [];
  return [
    ...searchCompetitions(query).slice(0, PER_KIND),
    ...searchNations(game, query).slice(0, PER_KIND),
    ...searchPlayers(game, query)
  ];
}
