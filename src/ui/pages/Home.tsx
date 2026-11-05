import { getPlayerName } from "../../engine/players/display";
import { Link } from "react-router-dom";
import { useGame } from "../../store/gameStore";
import { getWindowProgress } from "../../engine/game";
import { seasonDisplay } from "../../engine/config";
import { getActiveWindow } from "../../engine/international/calendar/windows";
import { getInternationalDisplayName } from "../../engine/international/calendar/windowCalendar";
import { getWorldRankings } from "../../engine/queries";
import { Empty, NationLink, OvrBadge, PageHeader, Panel, PlayerLink, PosBadge, Stat } from "../components/common";

export default function Home() {
  const game = useGame();
  const { world } = game;
  const progress = getWindowProgress(world);
  const window = getActiveWindow(world.international.windows);
  const nextMatchday = window ? window.matchdaysPlayed + 1 : 0;
  const nextRounds = window?.rounds.filter(round => round.matchday === nextMatchday) ?? [];

  const topNations = getWorldRankings(game).points.slice(0, 10);
  const topPlayers = [...world.players].sort((a, b) => b.overall - a.overall || b.potential - a.potential).slice(0, 10);

  return (
    <div>
      <PageHeader
        title="International Football"
        subtitle={`Season ${seasonDisplay(world.year)}${progress ? ` · ${progress.label}` : ""}`}
        right={<Link to="/international" className="btn-ghost">View window</Link>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 panel p-5 mb-6">
        <Stat label="Season" value={seasonDisplay(world.year)} />
        <Stat
          label="Open window"
          value={progress?.label ?? "–"}
          sub={progress ? `${progress.matchdaysPlayed}/${progress.matchdayCount} matchdays played` : undefined}
        />
        <Stat label="Nations" value={Object.keys(world.international.nations).length} />
        <Stat label="Players" value={world.players.length.toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={window ? `Next matchday · ${window.label} · matchday ${nextMatchday}` : "Next matchday"}
          right={<Link to="/international" className="text-xs text-accent-purple-light hover:underline">Full window</Link>}
        >
          {nextRounds.length === 0 ? <Empty>No fixtures scheduled.</Empty> : (
            <table className="tbl">
              <tbody>
                {nextRounds.map((round, index) => (
                  <tr key={`${round.lane}-${index}`}>
                    <td>{getInternationalDisplayName(round.label ?? "Friendlies")}</td>
                    <td className="num text-navy-300">{round.matches.length} match{round.matches.length === 1 ? "" : "es"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="World Rankings"
          right={<Link to="/rankings" className="text-xs text-accent-purple-light hover:underline">Full table</Link>}
        >
          <table className="tbl">
            <tbody>
              {topNations.map(row => (
                <tr key={row.code}>
                  <td className="w-10 text-center tabular-nums">{row.rank}</td>
                  <td><NationLink code={row.code} /></td>
                  <td className="num tabular-nums">{row.points.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Best players"
          right={<Link to="/player-search" className="text-xs text-accent-purple-light hover:underline">Player search</Link>}
        >
          <table className="tbl">
            <tbody>
              {topPlayers.map(player => (
                <tr key={player.id}>
                  <td className="w-10"><OvrBadge value={player.overall} /></td>
                  <td><PlayerLink id={player.id} name={getPlayerName(player)} /></td>
                  <td><PosBadge position={player.position} /></td>
                  <td><NationLink code={player.primaryNationality} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
