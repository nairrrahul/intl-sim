import playersRaw from "./data/players.json";
import { getNationCodeByName } from "../nations/nations";
import { formatPlayerId } from "./ids";
import { createSeasonRow } from "./progression";
import type { Player, Position } from "./types";

interface RawPlayer {
  playerid: number;
  firstName: string;
  lastName: string;
  commonName: string;
  age: number;
  overall: number;
  potential: number;
  position: Position;
}

/** players.json: nation name -> { players: [...] }. */
const rawPlayers = playersRaw as unknown as Record<string, { players: RawPlayer[] }>;

/** Builds the starting player pool from players.json. */
export function loadPlayersFromFile(year: number): Player[] {
  const players: Player[] = [];
  for (const [nationName, entry] of Object.entries(rawPlayers)) {
    const code = getNationCodeByName(nationName);
    if (!code) throw new Error(`players.json lists "${nationName}", which is not a known nation.`);
    for (const raw of entry.players) {
      players.push({
        id: formatPlayerId(raw.playerid),
        firstName: raw.firstName,
        lastName: raw.lastName,
        commonName: raw.commonName || null,
        primaryNationality: code,
        secondaryNationality: null,
        age: raw.age,
        overall: raw.overall,
        potential: Math.max(raw.potential, raw.overall),
        position: raw.position,
        playerType: null,
        peakRange: null,
        progression: [createSeasonRow(year, raw.age, raw.overall, Math.max(raw.potential, raw.overall))],
        caps: 0,
        u20Caps: 0,
        isShortlisted: false,
        retirementYear: null,
        isRetired: false
      });
    }
  }
  return players;
}

/** The first free player ID sequence number after the loaded players. */
export function nextSequenceAfter(players: Player[]): number {
  return players.reduce((highest, player) => Math.max(highest, Number(player.id.slice(1))), 0) + 1;
}
