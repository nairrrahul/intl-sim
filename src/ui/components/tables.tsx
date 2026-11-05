import { ROW_HIGHLIGHT } from "../styles";
import type { RowHighlights } from "../styles";
import { NationTag } from "./common";
import { ordinal } from "../format";

export interface InternationalGroupRow {
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface InternationalNthPlacedRow extends InternationalGroupRow {
  group: string;
}

export function InternationalNthPlacedTeamsTable(props: {
  place: number;
  advancingCount: number;
  rows: InternationalNthPlacedRow[];
  seedRanks: Record<string, number>;
  tieBreakers?: ("goalDifference" | "goalsFor")[];
}) {
  const tieBreakers = props.tieBreakers ?? ["goalDifference", "goalsFor"];
  const rows = [...props.rows].sort((a, b) =>
    b.points - a.points ||
    tieBreakers.reduce((difference, key) =>
      difference || b[key] - a[key], 0
    ) ||
    (props.seedRanks[a.code] ?? Number.MAX_SAFE_INTEGER) -
      (props.seedRanks[b.code] ?? Number.MAX_SAFE_INTEGER) ||
    a.code.localeCompare(b.code)
  );
  return (
    <section className="panel overflow-hidden">
      <details className="group">
        <summary className="panel-title list-none cursor-pointer hover:text-white">
          <span className="inline-flex items-center gap-2">
            <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
            {ordinal(props.place)} Placed Teams
          </span>
        </summary>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-8 text-center">#</th><th>Group</th><th>Nation</th><th className="num">P</th>
                <th className="num">W</th><th className="num">D</th><th className="num">L</th>
                <th className="num">GF</th><th className="num">GA</th><th className="num">GD</th><th className="num">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.group}-${row.code}`} className={index < props.advancingCount ? ROW_HIGHLIGHT.GREEN : ""}>
                  <td className="text-center tabular-nums">{index + 1}</td>
                  <td>{row.group}</td>
                  <td><NationTag code={row.code} label="name" /></td>
                  <td className="num">{row.played}</td><td className="num">{row.won}</td>
                  <td className="num">{row.drawn}</td><td className="num">{row.lost}</td>
                  <td className="num">{row.goalsFor}</td><td className="num">{row.goalsAgainst}</td>
                  <td className="num">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td className="num font-bold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/** Reusable standings table for international groups, with optional position-based highlighting. */
export function InternationalGroupTable(props: {
  rows: InternationalGroupRow[];
  highlights?: RowHighlights;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="w-8 text-center">#</th><th>Nation</th><th className="num">P</th>
            <th className="num">W</th><th className="num">D</th><th className="num">L</th>
            <th className="num">GF</th><th className="num">GA</th><th className="num">GD</th><th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={row.code} className={props.highlights?.[index + 1] ?? ""}>
              <td className="text-center tabular-nums">{index + 1}</td>
              <td><NationTag code={row.code} label="name" /></td>
              <td className="num">{row.played}</td><td className="num">{row.won}</td>
              <td className="num">{row.drawn}</td><td className="num">{row.lost}</td>
              <td className="num">{row.goalsFor}</td><td className="num">{row.goalsAgainst}</td>
              <td className="num">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="num font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
