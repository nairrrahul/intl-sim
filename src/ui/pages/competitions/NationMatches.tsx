import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../../../store/gameStore";
import { seasonDisplay } from "../../../engine/config";
import { getNationMatches } from "../../../engine/international/nationViews";
import { getCompetitionNameForKind } from "../../competitions";
import { Empty, NationLink, Panel, SeasonSelect } from "../../components/common";
import { useMatchInteractions } from "../../components/matchInteractions";
import { signed } from "../../format";

/** A nation's matches and scheduled fixtures by season, for its senior team or its U20 team. */
export function NationMatches(props: { code: string; team?: "senior" | "u20" }) {
  const game = useGame();
  const interactions = useMatchInteractions();
  const team = props.team ?? "senior";
  const matches = useMemo(
    () => getNationMatches(game.world.international, props.code, game.world.year, { team, version: game.version }),
    [game.world.international, game.world.year, game.version, props.code, team]
  );
  const matchYears = matches.map(match => match.year);
  const firstYear = Math.min(game.world.year, ...matchYears);
  const lastYear = Math.max(game.world.year, ...matchYears);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const [year, setYear] = useState(game.world.year);
  const rows = matches.filter(match => match.year === year);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <SeasonSelect years={years.map(y => ({ year: y, label: seasonDisplay(y) }))} value={year} onChange={setYear} />
      </div>
      <Panel title={`${team === "u20" ? "U20 matches" : "Matches"} — ${seasonDisplay(year)}`}>
        {rows.length === 0 ? (
          <Empty>No international matches or fixtures in this season.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Window</th><th>Competition</th><th>Stage</th><th>Opponent</th><th></th><th>Result</th><th className="num">Rating</th></tr>
              </thead>
              <tbody>
                {rows.map((match, index) => (
                  <tr key={index} className={interactions.matchClass(match.match)} {...interactions.matchProps(match.match)}>
                    <td className="text-navy-200">{match.windowLabel}</td>
                    <td>
                      {match.kind === "friendly" ? "Friendly" : match.competitionLink ? (
                        <Link className="link" to={match.competitionLink}>
                          {getCompetitionNameForKind(match.kind)}
                        </Link>
                      ) : match.kind}
                    </td>
                    <td className="text-xs text-navy-300">{match.stage ?? "–"}</td>
                    <td><NationLink code={match.opponent} /></td>
                    <td className="text-xs text-navy-300">{match.home ? "H" : "A"}</td>
                    <td className="tabular-nums">
                      {match.scheduled ? <span className="text-navy-300">Scheduled</span> : (
                        <>
                          <span className={`font-bold mr-1.5 ${match.outcome === "win" ? "text-accent-yellow" : match.outcome === "loss" ? "text-navy-300" : "text-white"}`}>
                            {match.outcome === "win" ? "W" : match.outcome === "loss" ? "L" : "D"}
                          </span>
                          {match.goalsFor}-{match.goalsAgainst}
                        </>
                      )}
                      {match.penaltyShootout && (
                        <span className="ml-1.5 text-navy-300">
                          ({match.penaltyShootout.goalsFor}-{match.penaltyShootout.goalsAgainst} PSO)
                        </span>
                      )}
                    </td>
                    <td className={`num ${match.pointsChange !== null && match.pointsChange > 0 ? "text-accent-yellow" : "text-navy-300"}`}>
                      {match.pointsChange === null ? "–" : signed(match.pointsChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

