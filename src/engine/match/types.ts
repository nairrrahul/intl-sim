/** The only things the match engine needs to know about a side. */
export interface MatchTeam {
  /** Three-letter nation code. */
  code: string;
  overall: number;
}

export interface MatchResult {
  homeGoalInfo: {
    homeTeam: MatchTeam;
    homeGoals: number;
    penalties: string[] | null;
  };
  awayGoalInfo: {
    awayTeam: MatchTeam;
    awayGoals: number;
    penalties: string[] | null;
  };
}
