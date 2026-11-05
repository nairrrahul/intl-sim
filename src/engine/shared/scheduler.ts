import type { Bracket, BracketMatch, BracketSlot, Fixture, LeagueSchedule } from "./bracketTypes";
import { shuffleInPlace } from "./random";

/** Seeded single-elimination brackets and round-robin schedules shared by every competition. */

function getBracketSize(teamCount: number): number {
  return 2 ** Math.ceil(Math.log2(teamCount));
}

function generateSeedOrder(bracketSize: number): number[] {
  let seeds = [1, 2];

  while (seeds.length < bracketSize) {
    const nextSize = seeds.length * 2;

    seeds = seeds.flatMap(seed => [
      seed,
      nextSize + 1 - seed
    ]);
  }

  return seeds;
}

function createInitialSlots<T>(bracketTeams: T[], seedOrder: number[]): BracketSlot<T>[] {
  return seedOrder.map(seed => ({
    seed,
    team: bracketTeams[seed - 1] ?? null
  }));
}

function createRoundOne<T>(slots: BracketSlot<T>[]): BracketMatch<T>[] {
  const matches: BracketMatch<T>[] = [];

  for (let i = 0; i < slots.length; i += 2) {
    const player1 = slots[i];
    const player2 = slots[i + 1];

    matches.push({
      id: `R1-M${matches.length + 1}`,
      round: 1,
      player1,
      player2,
      winner: null,
      sources: []
    });
  }

  return matches;
}

function createNextRound<T>(previousRound: BracketMatch<T>[], roundNumber: number): BracketMatch<T>[] {
  const matches: BracketMatch<T>[] = [];

  for (let i = 0; i < previousRound.length; i += 2) {
    const match1 = previousRound[i];
    const match2 = previousRound[i + 1];

    matches.push({
      id: `R${roundNumber}-M${matches.length + 1}`,
      round: roundNumber,

      player1: null,
      player2: null,

      winner: null,

      sources: [
        match1.id,
        match2.id
      ]
    });
  }

  return matches;
}

export function createKnockoutBracket<T>(bracketTeams: T[]): Bracket<T> {
  if (!Array.isArray(bracketTeams) || bracketTeams.length < 2) {
    throw new Error("bracketTeams must contain at least 2 teams.");
  }

  const bracketSize = getBracketSize(bracketTeams.length);
  const seedOrder = generateSeedOrder(bracketSize);
  const slots = createInitialSlots(bracketTeams, seedOrder);

  const rounds: BracketMatch<T>[][] = [
    createRoundOne(slots)
  ];

  let roundNumber = 2;

  while (rounds[rounds.length - 1].length > 1) {
    const previousRound = rounds[rounds.length - 1];

    rounds.push(
      createNextRound(previousRound, roundNumber)
    );

    roundNumber++;
  }

  return {
    size: bracketSize,
    activeRound: 0,
    rounds
  };
}

export function scheduleLeague<T>(teams: T[]): LeagueSchedule<T> {
  const modifiedTeams: (T | "X")[] = shuffleInPlace([...teams]);
  const matches: LeagueSchedule<T> = {};
  if (modifiedTeams.length % 2 === 1) {
    modifiedTeams.push("X");
  }

  const baseIterations = modifiedTeams.length - 1;

  const baseMatchdays: Fixture<T>[][] = [];
  for (let i = 0; i < baseIterations; i++) {
    const matchups: Fixture<T>[] = [];
    for (let j = 0; j < Math.floor(modifiedTeams.length / 2); j++) {
      const team1 = modifiedTeams[j];
      const team2 = modifiedTeams[modifiedTeams.length - 1 - j];
      if (team1 !== "X" && team2 !== "X") {
        matchups.push({
          homeTeam: team1,
          awayTeam: team2
        });
      }
    }
    baseMatchdays.push(matchups);
    const cycleOut = modifiedTeams.pop() as T | "X";
    modifiedTeams.splice(1, 0, cycleOut);
  }

  const allMatchdays: Fixture<T>[][] = [...baseMatchdays];
  baseMatchdays.forEach(matchdays => {
    const reversedMatches = matchdays.map(matchday => ({
      homeTeam: matchday.awayTeam,
      awayTeam: matchday.homeTeam
    }));
    allMatchdays.push(reversedMatches);
  });

  allMatchdays.forEach((matchday, index) => {
    matches[index + 1] = matchday;
  });
  return matches;
}
