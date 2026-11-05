import { seasonDisplay } from "../../../engine/config";
import { getPlayerName } from "../../../engine/players/display";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useGame, useGameStore } from "../../../store/gameStore";
import { getPlayer } from "../../../engine/game";
import type { ReactNode } from "react";
import { Empty, NationTag, OvrBadge, Panel, PosBadge, RetirementIcon, ShortlistButton, Stat, Tabs, TrophyIcon } from "../../components/common";
import type { Player, ProgressionEntry } from "../../../engine/players/types";

type Tab = "overview" | "progression" | "history";

function sumOf(rows: ProgressionEntry[], key: "goals" | "assists" | "cleanSheets"): number {
  return rows.reduce((total, row) => total + row[key], 0);
}

function ProgressionChart(props: { entries: ProgressionEntry[] }) {
  const { entries } = props;
  const width = 640;
  const height = 240;
  const pad = { left: 36, right: 16, top: 16, bottom: 28 };
  const values = entries.map(entry => entry.overall);
  const min = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5);
  const max = Math.min(100, Math.ceil((Math.max(...values) + 2) / 5) * 5);
  const x = (index: number) =>
    pad.left + (entries.length === 1 ? (width - pad.left - pad.right) / 2 : (index / (entries.length - 1)) * (width - pad.left - pad.right));
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const ticks: number[] = [];
  for (let v = min; v <= max; v += 5) ticks.push(v);
  const overall = entries.map((entry, i) => `${x(i)},${y(entry.overall)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {ticks.map(tick => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#213a75" strokeWidth={1} />
          <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={8} fill="#7d93c6">{tick}</text>
        </g>
      ))}
      <polyline points={overall} fill="none" stroke="#facc15" strokeWidth={2.5} />
      {entries.map((entry, i) => (
        <g key={entry.year}>
          <circle cx={x(i)} cy={y(entry.overall)} r={3.5} fill="#facc15" />
          {(entries.length <= 12 || i % 2 === 0 || i === entries.length - 1) && (
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize={8} fill="#aab9dc">{entry.year}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** God Mode: set a player's current overall and potential (growth continues from the new values). */
function PlayerRatingsEditor(props: { player: Player }) {
  const setRatings = useGameStore(s => s.godSetPlayerRatings);
  const [overall, setOverall] = useState(String(props.player.overall));
  const [potential, setPotential] = useState(String(props.player.potential));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const result = setRatings(props.player.id, Number(overall), Number(potential));
    setError(result.ok ? null : result.error ?? "Unable to update the player.");
  };
  const digits = (value: string) => value.replace(/\D/g, "");

  return (
    <Panel title="Edit ratings (God Mode)">
      <div className="p-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-navy-200">
            Overall
            <input className="input mt-1 w-full" inputMode="numeric" value={overall} onChange={event => setOverall(digits(event.target.value))} />
          </label>
          <label className="text-navy-200">
            Potential
            <input className="input mt-1 w-full" inputMode="numeric" value={potential} onChange={event => setPotential(digits(event.target.value))} />
          </label>
        </div>
        {error && <p role="alert" className="text-accent-yellow">{error}</p>}
        <button className="btn-yellow" disabled={overall === "" || potential === ""} onClick={save}>Save ratings</button>
      </div>
    </Panel>
  );
}

export default function PlayerPage() {
  const game = useGame();
  const params = useParams();
  const [tab, setTab] = useState<Tab>("overview");
  const player = params.id ? getPlayer(game, params.id) : null;

  if (!player) {
    return (
      <Panel title="Player not found">
        <Empty>No player found with ID {params.id}.</Empty>
      </Panel>
    );
  }

  const isGoalkeeper = player.position === "GK";
  const retiringThisSeason = !player.isRetired && player.retirementYear === game.world.year;
  const progression = player.progression;

  return (
    <div>
      <div className="panel p-6 mb-4 flex flex-wrap items-center gap-6">
        <OvrBadge value={player.overall} size="xl" />
        <div className="flex-1 min-w-[16rem]">
          <h1 className="text-3xl font-bold leading-tight flex items-center gap-3">
            {getPlayerName(player)}
            {retiringThisSeason && <RetirementIcon className="text-accent-yellow text-2xl" title="Retiring at the end of this season" />}
            <ShortlistButton playerId={player.id} shortlisted={player.isShortlisted} className="text-2xl" />
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy-200">
            <PosBadge position={player.position} />
            {player.isRetired && <span className="text-navy-300 font-semibold">Retired</span>}
          </div>
          {retiringThisSeason && (
            <p className="mt-2 text-sm text-accent-yellow" role="status">
              This player is scheduled to retire at the end of {seasonDisplay(player.retirementYear as number)}.
            </p>
          )}
          <div className="mt-3 text-left">
            <div className="text-xl font-semibold">
              <NationTag code={player.primaryNationality} label="name" />
            </div>
            {player.secondaryNationality && (
              <div className="text-xs text-navy-300 mt-0.5">
                <NationTag code={player.secondaryNationality} label="name" muted />
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6 text-center">
          <Stat label="Age" value={player.age} />
          <Stat label="Overall" value={player.overall} />
          <Stat label="Potential" value={<span className="text-accent-purple-light">{player.potential}</span>} />
          <Stat label="Caps" value={player.caps} />
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "progression", label: "Overall progression" },
          { id: "history", label: "History" }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Details">
            <dl className="divide-y divide-navy-700/60 text-sm">
              {([
                ["Position", player.position],
                ["Primary nationality", <NationTag key="n1" code={player.primaryNationality} label="name" />],
                ["Secondary nationality", player.secondaryNationality ? <NationTag key="n2" code={player.secondaryNationality} label="name" /> : "None"],
                ["Age", player.age],
                ["Overall", player.overall],
                ["Potential", player.potential],
                ["International", (
                  <span key="intl" className="flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      {player.caps} {player.caps === 1 ? "cap" : "caps"} for <NationTag code={player.primaryNationality} label="name" muted />
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-navy-300">
                      {player.u20Caps} {player.u20Caps === 1 ? "appearance" : "appearances"} for
                      <NationTag code={player.primaryNationality} label="name" muted /> U20
                    </span>
                  </span>
                )]
              ] as [string, ReactNode][]).map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2">
                  <dt className="text-navy-300">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {game.world.godMode && <PlayerRatingsEditor key={`${player.id}-${player.overall}-${player.potential}`} player={player} />}
        </div>
      )}

      {tab === "progression" && (
        <div className="space-y-6">
          <Panel
            title="Overall by season"
          >
            <div className="p-4">
              {progression.length < 2 && (
                <p className="text-xs text-navy-300 mb-2">Progression is recorded each time a new season begins.</p>
              )}
              <ProgressionChart entries={progression} />
            </div>
          </Panel>
          <Panel title="Year by year">
            <table className="tbl">
              <thead>
                <tr><th>Season</th><th className="num">Age</th><th className="num">OVR</th><th className="num">Change</th><th className="num">POT</th></tr>
              </thead>
              <tbody>
                {[...progression].reverse().map((entry, reversedIndex) => {
                  const index = progression.length - 1 - reversedIndex;
                  const previous = index > 0 ? progression[index - 1] : null;
                  const delta = previous ? entry.overall - previous.overall : null;
                  return (
                    <tr key={entry.year}>
                      <td>{seasonDisplay(entry.year)}</td>
                      <td className="num">{entry.age}</td>
                      <td className="num font-semibold">{entry.overall}</td>
                      <td className={`num ${delta === null ? "text-navy-400" : delta > 0 ? "text-accent-yellow" : delta < 0 ? "text-navy-300" : ""}`}>
                        {delta === null ? "–" : delta > 0 ? `+${delta}` : delta}
                      </td>
                      <td className="num text-navy-200">{entry.potential}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {tab === "history" && (
        <Panel title="Season history">
          {progression.length === 0 ? <Empty>No history yet.</Empty> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Season</th>
                  <th className="num">Age</th>
                  <th className="num">Caps</th>
                  {isGoalkeeper
                    ? <th className="num">Clean sheets</th>
                    : <><th className="num">Goals</th><th className="num">Assists</th></>}
                  <th>Trophies</th>
                </tr>
              </thead>
              <tbody>
                {[...progression].reverse().map(entry => (
                  <tr key={entry.year}>
                    <td>{seasonDisplay(entry.year)}</td>
                    <td className="num">{entry.age}</td>
                    <td className="num">{entry.caps}</td>
                    {isGoalkeeper
                      ? <td className="num">{entry.cleanSheets}</td>
                      : <><td className="num">{entry.goals}</td><td className="num">{entry.assists}</td></>}
                    <td>
                      <span className="inline-flex gap-1">
                        {entry.trophies.map((trophy, index) => <TrophyIcon key={index} name={trophy} />)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2}>Total</td>
                  <td className="num">{player.caps}</td>
                  {isGoalkeeper
                    ? <td className="num">{sumOf(progression, "cleanSheets")}</td>
                    : <><td className="num">{sumOf(progression, "goals")}</td><td className="num">{sumOf(progression, "assists")}</td></>}
                  <td>{progression.reduce((total, entry) => total + entry.trophies.length, 0) || ""}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Panel>
      )}
    </div>
  );
}
