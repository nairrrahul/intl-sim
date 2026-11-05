import { useMatchInteractions } from "../../components/matchInteractions";
import { useState } from "react";
import { useGame } from "../../../store/gameStore";
import { seasonDisplay } from "../../../engine/config";
import type { InternationalMatch, ScheduledRound, WindowRecord } from "../../../engine/international/types";
import { getWindowMatchdayCount } from "../../../engine/international/lanes";
import { getInternationalDisplayName, getInternationalWindowLabel } from "../../../engine/international/calendar/windowCalendar";
import { Empty, NationLink, PageHeader, Panel, SeasonSelect } from "../../components/common";

function change(value: number | null): string {
  if (value === null) return "";
  const text = Math.abs(value).toFixed(2);
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}

function FixtureRow(props: { match: InternationalMatch }) {
  const { match } = props;
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const interactions = useMatchInteractions();
  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5 border-b border-navy-700/60 text-sm ${interactions.matchClass(match)}`}
      {...interactions.matchProps(match)}
    >
      <div className="flex items-center justify-end gap-2">
        {played && <span className={`text-xs tabular-nums ${match.homeChange! > 0 ? "text-accent-yellow" : "text-navy-300"}`}>{change(match.homeChange)}</span>}
        <NationLink code={match.home} />
      </div>
      <div className="min-w-[4.5rem] text-center font-bold tabular-nums bg-navy-900 rounded px-2 py-0.5">
        {played ? `${match.homeGoals}-${match.awayGoals}` : "–"}
      </div>
      <div className="flex items-center gap-2">
        <NationLink code={match.away} />
        {played && <span className={`text-xs tabular-nums ${match.awayChange! > 0 ? "text-accent-yellow" : "text-navy-300"}`}>{change(match.awayChange)}</span>}
      </div>
    </div>
  );
}

/** Window sections in display order: the match kind of their rounds, and the heading shown. */
const WINDOW_SECTIONS: { kind: string; title: string; splitByConfederation?: boolean }[] = [
  { kind: "friendly", title: "International Friendlies" },
  { kind: "nationsLeague", title: "Nations League", splitByConfederation: true },
  { kind: "goldCupPlayoff", title: "Gold Cup Playoff" },
  { kind: "goldCup", title: "Gold Cup" },
  { kind: "copaAmerica", title: "Copa América" },
  { kind: "confedCup", title: "Confederations Cup" },
  { kind: "u20WorldCup", title: "U20 World Cup" },
  { kind: "afconQualifier", title: "AFCON Qualifiers" },
  { kind: "afcon", title: "AFCON" },
  { kind: "afcCupQualifier", title: "Asian Cup Qualifiers" },
  { kind: "afcCup", title: "Asian Cup" },
  { kind: "ofcCupQualifier", title: "OFC Cup Qualifiers" },
  { kind: "ofcCup", title: "OFC Cup" },
  { kind: "euroQualifier", title: "EURO Qualifiers" },
  { kind: "euro", title: "UEFA EURO" },
  { kind: "worldCupQualifier", title: "World Cup Qualifiers" },
  { kind: "worldCup", title: "World Cup" }
];

function groupByConfederation(matches: InternationalMatch[]): [string, InternationalMatch[]][] {
  const groups = new Map<string, InternationalMatch[]>();
  for (const match of matches) {
    const confederation = match.nationsLeagueConfederation ?? "Confederation unavailable";
    groups.set(confederation, [...(groups.get(confederation) ?? []), match]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function RoundPanel(props: { round: ScheduledRound; index: number; window: WindowRecord; splitByConfederation: boolean }) {
  const { round, window } = props;
  const roundPlayed = round.matchday <= window.matchdaysPlayed;
  return (
    <Panel
      title={getInternationalDisplayName(round.label ?? `Friendlies · Set ${props.index + 1}`)}
      right={
        <span className="flex items-center gap-3">
          {round.leftOut && <span className="text-navy-300 flex items-center gap-1.5">No match: <NationLink code={round.leftOut} /></span>}
          <span className={`text-xs font-bold rounded px-2 py-0.5 ${roundPlayed ? "bg-navy-600 text-white" : "bg-navy-900 text-navy-200"}`}>
            Matchday {round.matchday}
          </span>
        </span>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {props.splitByConfederation ? (
          groupByConfederation(round.matches).map(([confederation, matches]) => (
            <section key={confederation}>
              <h3 className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-navy-300">{confederation}</h3>
              {matches.map((match, matchIndex) => <FixtureRow key={matchIndex} match={match} />)}
            </section>
          ))
        ) : (
          round.matches.map((match, matchIndex) => <FixtureRow key={matchIndex} match={match} />)
        )}
      </div>
    </Panel>
  );
}

function WindowView(props: { window: WindowRecord }) {
  const { window } = props;
  const played = window.status === "played";
  const matchdayCount = getWindowMatchdayCount(window);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-navy-200">
        <span className="font-semibold text-white">{window.label}</span>
        <span>{played ? `${matchdayCount} matchdays` : `Matchday ${window.matchdaysPlayed}/${matchdayCount} played`}</span>
        <span className={`text-xs font-bold rounded px-2 py-0.5 ${played ? "bg-navy-600 text-white" : "bg-accent-yellow text-navy-950"}`}>
          {played ? "Played" : "Scheduled"}
        </span>
      </div>
      {WINDOW_SECTIONS.map(section => {
        const rounds = window.rounds.filter(round => (round.kind ?? "friendly") === section.kind);
        if (rounds.length === 0) return null;
        return (
          <section key={section.kind} className="space-y-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {rounds.map((round, index) => (
              <RoundPanel
                key={`${round.label ?? round.kind}-${index}`}
                round={round}
                index={index}
                window={window}
                splitByConfederation={section.splitByConfederation === true}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

export default function Windows() {
  const game = useGame();
  const windows = game.world.international.windows;
  const years = [...new Set(windows.map(window => window.year))];
  if (!years.includes(game.world.year)) years.push(game.world.year);
  years.sort((a, b) => a - b);

  const [year, setYear] = useState(game.world.year);
  const ofYear = windows.filter(window => window.year === year);
  const [windowId, setWindowId] = useState<string | null>(null);
  const openWindow = ofYear.find(window => window.status === "scheduled");
  const selected = ofYear.find(window => window.windowId === windowId) ?? openWindow ?? ofYear[ofYear.length - 1] ?? null;

  return (
    <div>
      <PageHeader
        title="International Windows"
        subtitle="Every window is simulated matchday by matchday: each matchday plays the next round of every competition in the window"
        right={
          <SeasonSelect
            years={years.map(y => ({ year: y, label: seasonDisplay(y) }))}
            value={year}
            onChange={y => { setYear(y); setWindowId(null); }}
          />
        }
      />

      {ofYear.length === 0 ? (
        <Panel>
          <Empty>No international window has been opened in {seasonDisplay(year)} yet.</Empty>
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {ofYear.map(window => (
              <button
                key={window.windowId}
                onClick={() => setWindowId(window.windowId)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium border ${
                  selected?.windowId === window.windowId
                    ? "bg-accent-purple border-accent-purple-light text-white"
                    : "bg-navy-900 border-navy-600 text-navy-100 hover:border-accent-purple"
                }`}
              >
                {getInternationalWindowLabel(window.windowId)}
                {window.status === "scheduled" && <span className="ml-1.5 text-accent-yellow">●</span>}
              </button>
            ))}
          </div>
          {selected && <WindowView key={`${selected.year}-${selected.windowId}`} window={selected} />}
        </>
      )}
    </div>
  );
}
