import NationSquad from "./NationSquad";
import { useMatchInteractions } from "../../components/matchInteractions";
import { getPlayerName } from "../../../engine/players/display";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useGame, useGameStore } from "../../../store/gameStore";
import { getWorldRankings } from "../../../engine/queries";
import { getConfederation, getNationName } from "../../../engine/nations/nations";
import { getNationTrophies } from "../../../engine/international/trophies";
import { getNationMatches } from "../../../engine/international/nationViews";
import { getNationRankingHistory } from "../../../engine/international/rankings";
import { seasonDisplay } from "../../../engine/config";
import { getCompetitionNameForKind } from "../../competitions";
import {
  Empty, NationLink, OvrBadge, PageHeader, Panel, PlayerLink, PosBadge, SeasonSelect, ShortlistButton, Stat, Tabs, RetiringMark } from "../../components/common";
import { FlagIcon } from "../../components/FlagIcon";

type Tab = "overview" | "squad" | "u20" | "players" | "ranking" | "matches" | "history";

/** Seasons of ranking history shown ("past 5 years"). */
const RANKING_HISTORY_YEARS = 10;

function signed(value: number, digits = 2): string {
  const text = Math.abs(value).toFixed(digits);
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}

function PlayersTab(props: { code: string }) {
  const game = useGame();
  const players = game.world.players
    .filter(player => !player.isRetired && player.primaryNationality === props.code)
    .sort((a, b) => b.overall - a.overall || b.potential - a.potential)
    .slice(0, 25);
  return (
    <Panel title="Best players">
      {players.length === 0 ? (
        <Empty>No players from {getNationName(props.code)} have been generated yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th className="w-8"></th><th>Pos</th><th>Name</th><th className="num">Age</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Caps</th></tr>
            </thead>
            <tbody>
              {players.map(player => (
                <tr key={player.id}>
                  <td><ShortlistButton playerId={player.id} shortlisted={player.isShortlisted} /></td>
                  <td><PosBadge position={player.position} /></td>
                  <td><PlayerLink id={player.id} name={getPlayerName(player)} /><RetiringMark player={player} seasonYear={game.world.year} /></td>
                  <td className="num">{player.age}</td>
                  <td className="num"><OvrBadge value={player.overall} /></td>
                  <td className="num text-navy-200">{player.potential}</td>
                  <td className="num">{player.caps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/**
 * Ranking after each window. Rank 1 is at the top (like a Football Manager ranking graph), so a
 * rising line means a better ranking.
 */
function RankingChart(props: { entries: { year: number; label: string; rank: number }[]; totalNations: number }) {
  const { entries } = props;
  const width = 640;
  const height = 240;
  const pad = { left: 40, right: 16, top: 16, bottom: 28 };
  // Full world-ranking scale: #1 at the top, the last-ranked nation at the bottom.

  const lowest = Math.min(...entries.map(entry => entry.rank));
  const highest = Math.max(...entries.map(entry => entry.rank));
  const buffer = highest - lowest < 20 ? 5 : 0;
  const min = Math.max(1, lowest - buffer);
  const max = Math.min(props.totalNations, highest + buffer)

  const x = (index: number) =>
    pad.left + (entries.length === 1 ? (width - pad.left - pad.right) / 2 : (index / (entries.length - 1)) * (width - pad.left - pad.right));
  // Inverted: the best (lowest) rank is drawn highest.
  const y = (rank: number) => pad.top + ((rank - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const ticks = [...new Set(Array.from({ length: 5 }, (_, i) => Math.round(min + ((max - min) * i) / 4)))];
  const line = entries.map((entry, i) => `${x(i)},${y(entry.rank)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#213a75" strokeWidth={1} />
          <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={8} fill="#7d93c6">{tick}</text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke="#facc15" strokeWidth={2.5} strokeLinejoin="round" />
      {entries.map((entry, i) => {
        const firstOfSeason = i === 0 || entries[i - 1].year !== entry.year;
        return (
          <g key={`${entry.year}-${i}`}>
            <circle cx={x(i)} cy={y(entry.rank)} r={3.5} fill="#facc15">
              <title>{`${seasonDisplay(entry.year)} · ${entry.label}: #${entry.rank}`}</title>
            </circle>
            {firstOfSeason && (
              <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={8} fill="#aab9dc">{seasonDisplay(entry.year)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RankingTab(props: { code: string }) {
  const game = useGame();
  const all = getNationRankingHistory(game.world.international, props.code);
  const withChange = all.map((entry, index) => ({
    ...entry,
    rankChange: index > 0 ? all[index - 1].rank - entry.rank : null,
    pointsChange: index > 0 ? entry.points - all[index - 1].points : null
  }));
  // Chronological (for the graph); the table below shows the same entries newest first.
  const windowed = withChange.filter(entry => entry.year > game.world.year - RANKING_HISTORY_YEARS);
  const shown = [...windowed].reverse();

  return (
    <div className="space-y-6">
    {windowed.length > 0 && (
      <Panel title="World ranking after each window">
        <div className="p-4">
          <RankingChart entries={windowed} totalNations={Object.keys(game.world.international.nations).length} />
        </div>
      </Panel>
    )}
    <Panel title={`Ranking history — last ${RANKING_HISTORY_YEARS} seasons`}>
      {shown.length === 0 ? (
        <Empty>No international window has been completed yet. Rankings are recorded after each window.</Empty>
      ) : (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="tbl">
            <thead>
              <tr><th>Season</th><th>After</th><th className="num">Rank</th><th className="num">Change</th><th className="num">Points</th><th className="num">Change</th></tr>
            </thead>
            <tbody>
              {shown.map(entry => (
                <tr key={`${entry.year}-${entry.windowId}`}>
                  <td className="font-medium">{seasonDisplay(entry.year)}</td>
                  <td className="text-navy-200">{entry.label}</td>
                  <td className="num font-semibold">{entry.rank}</td>
                  <td className={`num ${entry.rankChange === null ? "text-navy-400" : entry.rankChange > 0 ? "text-accent-yellow" : entry.rankChange < 0 ? "text-navy-300" : ""}`}>
                    {entry.rankChange === null ? "–" : entry.rankChange > 0 ? `▲ ${entry.rankChange}` : entry.rankChange < 0 ? `▼ ${-entry.rankChange}` : "–"}
                  </td>
                  <td className="num">{entry.points.toFixed(2)}</td>
                  <td className={`num ${entry.pointsChange === null ? "text-navy-400" : entry.pointsChange > 0 ? "text-accent-yellow" : entry.pointsChange < 0 ? "text-navy-300" : ""}`}>
                    {entry.pointsChange === null ? "–" : signed(entry.pointsChange)}
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

/** The nation's youth rating; editable in God Mode. */
function YouthRatingStat(props: { code: string }) {
  const game = useGame();
  const setRating = useGameStore(s => s.godSetYouthRating);
  const nation = game.world.international.nations[props.code];
  const [draft, setDraft] = useState<string | null>(null);

  if (!game.world.godMode) {
    return <Stat label="Youth rating" value={nation.youthRating} sub="Drives newgen quality" />;
  }
  const commit = () => {
    if (draft !== null && draft !== "") setRating(props.code, Number(draft));
    setDraft(null);
  };
  return (
    <Stat
      label="Youth rating"
      value={
        <input
          className="input w-20 text-center"
          inputMode="numeric"
          value={draft ?? String(nation.youthRating)}
          onChange={event => setDraft(event.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={event => { if (event.key === "Enter") commit(); }}
          aria-label="Youth rating"
        />
      }
      sub="0-200 · God Mode"
    />
  );
}

function MatchesTab(props: { code: string }) {
  const game = useGame();
  const interactions = useMatchInteractions();
  const matches = getNationMatches(game.world.international, props.code, game.world.year);
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
      <Panel title={`Matches — ${seasonDisplay(year)}`}>
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

function NationHistoryTab(props: { code: string }) {
  const game = useGame();
  const trophies = getNationTrophies(game.world.international, props.code);
  const grouped = new Map<string, number[]>();
  for (const trophy of trophies) {
    const years = grouped.get(trophy.name) ?? [];
    years.push(trophy.year);
    grouped.set(trophy.name, years);
  }

  return (
    <Panel title={`Trophies (${trophies.length})`}>
      {trophies.length === 0 ? <Empty>No trophies won yet.</Empty> : (
        <div className="divide-y divide-navy-700/60">
          {[...grouped.entries()].map(([name, years]) => (
            <div key={name} className="flex items-center gap-4 px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-yellow font-bold text-navy-950">
                {years.length}
              </span>
              <div>
                <div className="font-semibold">{name}</div>
                <div className="text-xs text-navy-300">{years.join(", ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function NationPage() {
  const game = useGame();
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  const [tab, setTab] = useState<Tab>("overview");

  const confederation = getConfederation(code);
  if (!confederation) return <Navigate to="/rankings" replace />;

  const state = game.world.international;
  const nation = state.nations[code];
  const { points, overall } = getWorldRankings(game);
  const rank = points.find(row => row.code === code)?.rank ?? 0;
  const overallRank = overall.find(row => row.code === code)?.rank ?? 0;
  const nationPlayers = game.world.players
    .filter(player => !player.isRetired && player.primaryNationality === code)
    .sort((a, b) => b.overall - a.overall || b.potential - a.potential);
  const playerCount = nationPlayers.length;
  const bestPlayers = nationPlayers.slice(0, 6);

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <FlagIcon code={code} size={1.1} />
            {getNationName(code)}
          </span>
        }
        subtitle={`National team · ${confederation}`}
      />
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "squad", label: "Starting XI" },
          { id: "u20", label: "U20 Squad" },
          { id: "players", label: "Best players" },
          { id: "ranking", label: "Ranking history" },
          { id: "matches", label: "Match history" },
          { id: "history", label: "History" }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "squad" && <NationSquad code={code} />}
      {tab === "u20" && <NationSquad code={code} team="u20" />}

      {tab === "overview" && (
        <div className="space-y-6">
        <Panel title="National team">
          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-6">
            <Stat label="World ranking" value={`#${rank}`} sub={`of ${points.length}`} />
            <Stat label="Ranking points" value={nation.points.toFixed(2)} />
            <Stat
              label="Squad overall"
              value={<OvrBadge value={nation.overall} size="lg" />}
              sub={`${nation.formation} · #${overallRank} by overall`}
            />
            <Stat label="Confederation" value={confederation} sub={`${playerCount} player${playerCount === 1 ? "" : "s"} in the game`} />
            <YouthRatingStat code={code} />
          </div>
        </Panel>
        {bestPlayers.length > 0 && (
          <Panel title="Best players">
            <table className="tbl">
              <tbody>
                {bestPlayers.map(player => (
                  <tr key={player.id}>
                    <td className="w-10"><OvrBadge value={player.overall} /></td>
                    <td><PlayerLink id={player.id} name={getPlayerName(player)} /><RetiringMark player={player} seasonYear={game.world.year} /></td>
                    <td><PosBadge position={player.position} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
        </div>
      )}
      {tab === "players" && <PlayersTab code={code} />}
      {tab === "ranking" && <RankingTab code={code} />}
      {tab === "matches" && <MatchesTab code={code} />}
      {tab === "history" && <NationHistoryTab code={code} />}
    </div>
  );
}
