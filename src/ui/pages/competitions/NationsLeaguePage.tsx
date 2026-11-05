import { useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  getNationsLeagueDivisionHistory, getNationsLeagueStandings, isNationsLeagueConfederation
} from "../../../engine/international/competitions/nationsLeague";
import type { NationsLeagueEdition, NationsLeagueGroup } from "../../../engine/international/competitions/nationsLeague";
import { seasonDisplay } from "../../../engine/config";
import { computeRankings } from "../../../engine/international/rankings";
import { useGame } from "../../../store/gameStore";
import { Empty, NationLink, PageHeader, Panel, Tabs } from "../../components/common";
import { InternationalGroupMatchdays } from "../../components/InternationalGroupMatchdays";
import { InternationalGroupTable, InternationalNthPlacedTeamsTable } from "../../components/tables";
import { ROW_HIGHLIGHT } from "../../styles";
import type { RowHighlights } from "../../styles";
import type { InternationalMatch } from "../../../engine/international/types";

type Tab = "current" | "history" | "divisionHistory";

/**
 * Position highlights for a Nations League group: green for promotion, red for relegation.
 * Rules differ by confederation and League (A is the top division).
 */
function getGroupHighlights(confederation: string, division: string, groupSize: number): RowHighlights {
  const first = { 1: ROW_HIGHLIGHT.GREEN };
  const lastRed = { [groupSize]: ROW_HIGHLIGHT.RED };
  if (confederation === "CONCACAF") {
    if (division === "A") return lastRed;
    if (division === "B") return { ...first, ...lastRed };
    if (division === "C") return first;
  }
  if (confederation === "UEFA") {
    if (division === "A") return lastRed;
    if (division === "B" || division === "C") return { ...first, ...lastRed };
    if (division === "D") return { 1: ROW_HIGHLIGHT.GREEN, 2: ROW_HIGHLIGHT.GREEN };
  }
  return {};
}

/** A group's fixtures as rounds (index 0 = matchday 1). */
function getGroupRounds(edition: NationsLeagueEdition, division: string, group: NationsLeagueGroup): InternationalMatch[][] {
  const rounds: InternationalMatch[][] = [];
  for (const match of edition.matches) {
    if (match.nationsLeagueDivision !== division || match.nationsLeagueGroup !== group.name) continue;
    const index = (match.nationsLeagueRound ?? 1) - 1;
    (rounds[index] ??= []).push(match);
  }
  return Array.from(rounds, round => round ?? []);
}

function GroupTable(props: {
  edition: NationsLeagueEdition;
  division: string;
  group: NationsLeagueGroup;
}) {
  const { edition, division, group } = props;
  const rows = getNationsLeagueStandings(edition, division, group);
  return (
    <Panel title={`Group ${group.name}`}>
      <InternationalGroupTable rows={rows} highlights={getGroupHighlights(edition.confederation, division, rows.length)} />
      <InternationalGroupMatchdays rounds={getGroupRounds(edition, division, group)} />
    </Panel>
  );
}

function EditionTables(props: {
  edition: NationsLeagueEdition;
  goldCupWorldRanks?: Record<string, number>;
}) {
  return (
    <div className="space-y-5">
      {Object.entries(props.edition.divisions).sort(([a], [b]) => a.localeCompare(b)).map(([division, groups]) => (
        <section key={division} className="space-y-3">
          <h3 className="text-lg font-semibold">League {division}</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map(group => (
              <GroupTable
                key={`${division}-${group.name}`}
                edition={props.edition}
                division={division}
                group={group}
              />
            ))}
          </div>
          {props.edition.confederation === "CONCACAF" && division === "B" && props.goldCupWorldRanks && (
            <InternationalNthPlacedTeamsTable
              place={3}
              advancingCount={2}
              seedRanks={props.goldCupWorldRanks}
              tieBreakers={["goalDifference"]}
              rows={groups.flatMap(group =>
                getNationsLeagueStandings(props.edition, division, group)
                  .filter(row => row.position === 3)
                  .map(row => ({ ...row, group: group.name }))
              )}
            />
          )}
        </section>
      ))}
    </div>
  );
}

function PromotionRelegationOverview(props: { edition: NationsLeagueEdition; right?: ReactNode }) {
  const divisions = Object.keys(props.edition.divisions).sort();
  return (
    <Panel title="Promotion and Relegation Overview" right={props.right}>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Division</th>
              <th>Promoted</th>
              <th>Relegated</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map(division => (
              <tr key={division}>
                <td className="font-semibold">League {division}</td>
                <td>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {(props.edition.promoted[division] ?? []).map(code => <NationLink key={code} code={code} />)}
                    {(props.edition.promoted[division] ?? []).length === 0 && <span className="text-navy-400">—</span>}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {(props.edition.relegated[division] ?? []).map(code => <NationLink key={code} code={code} />)}
                    {(props.edition.relegated[division] ?? []).length === 0 && <span className="text-navy-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function DivisionBadge(props: { division: string }) {
  const tones: Record<string, string> = {
    A: "bg-yellow-400 text-black",
    B: "bg-purple-700 text-white",
    C: "bg-purple-300 text-black",
    D: "bg-gray-500 text-white"
  };
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-sm text-xs font-bold ${tones[props.division] ?? "bg-navy-500 text-white"}`}>
      {props.division}
    </span>
  );
}

function DivisionHistory(props: { editions: NationsLeagueEdition[] }) {
  const { editions, rows } = getNationsLeagueDivisionHistory(props.editions);
  if (rows.length === 0) {
    return <Panel><Empty>No completed edition is available for division history yet.</Empty></Panel>;
  }
  const rankColumnWidth = 56;
  const nationColumnWidth = 220;
  const editionColumnWidth = 96;
  const tableWidth = rankColumnWidth + nationColumnWidth + editions.length * editionColumnWidth;

  return (
    <Panel title="Division history">
      <div className="w-full overflow-x-auto">
        <table className="tbl division-history-table table-fixed" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: rankColumnWidth }} />
            <col style={{ width: nationColumnWidth }} />
            {editions.map(edition => <col key={edition.id} style={{ width: editionColumnWidth }} />)}
          </colgroup>
          <thead>
            <tr>
              <th
                className="division-history-sticky sticky left-0 z-20 bg-navy-800 text-center"
                style={{ textAlign: "center" }}
              >
                Rank
              </th>
              <th
                className="division-history-sticky sticky z-20 bg-navy-800"
                style={{ left: rankColumnWidth }}
              >
                Nation
              </th>
              {editions.map(edition => (
                <th key={edition.id} className="text-center whitespace-nowrap" style={{ textAlign: "center" }}>
                  {seasonDisplay(edition.year)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.code}>
                <td className="division-history-sticky sticky left-0 z-10 bg-navy-800 text-center tabular-nums">
                  {row.aggregateRank}
                </td>
                <td
                  className="division-history-sticky sticky z-10 bg-navy-800"
                  style={{ left: rankColumnWidth }}
                >
                  <NationLink code={row.code} />
                </td>
                {editions.map(edition => (
                  <td key={edition.id} className="text-center" style={{ textAlign: "center" }}>
                    <div className="flex w-full justify-center">
                      {row.divisions[edition.id]
                        ? <DivisionBadge division={row.divisions[edition.id]} />
                        : "—"}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function NationsLeaguePage() {
  const game = useGame();
  const { confederation: rawConfederation } = useParams();
  const confederation = String(rawConfederation ?? "").toUpperCase();
  const [tab, setTab] = useState<Tab>("current");
  const [historyEditionId, setHistoryEditionId] = useState<string | null>(null);
  if (!isNationsLeagueConfederation(confederation)) return <Navigate to="/international" replace />;

  const editions = game.world.international.nationsLeague.editions
    .filter(edition => edition.confederation === confederation)
    .sort((a, b) => b.startWindowIndex - a.startWindowIndex);
  const current = editions[0] ?? null;
  const currentWorldRanks = Object.fromEntries(
    computeRankings(game.world.international).map(row => [row.code, row.rank])
  );
  const history = editions.filter(edition => edition.status === "complete");
  const historyEdition = history.find(edition => edition.id === historyEditionId) ?? history[0] ?? null;
  const historyIndex = historyEdition ? history.findIndex(edition => edition.id === historyEdition.id) : -1;

  return (
    <div>
      <PageHeader
        title={`${confederation} Nations League`}
        subtitle="Home-and-away group stage played during designated international windows"
      />
      <Tabs
        tabs={[
          { id: "current", label: "Current league standings" },
          { id: "history", label: "History" },
          { id: "divisionHistory", label: "Division History" }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "current" && (
        current ? (
          <div className="space-y-4">
            <Panel
              title={seasonDisplay(current.year)}
              right={<span className="capitalize">{current.status}</span>}
            >
              {current.status === "scheduled" && (
                <p className="px-3 py-2 text-sm text-navy-300">
                  The groups have been drawn. The league stage begins in its first assigned Nations League window.
                </p>
              )}
              {current.status === "active" && (
                <p className="px-3 py-2 text-sm text-navy-300">League standings update as each international window is simulated.</p>
              )}
              {current.status === "complete" && (
                <p className="px-3 py-2 text-sm text-navy-300">The league stage is complete. Promotion and relegation have been applied for the next edition.</p>
              )}
            </Panel>
            <EditionTables edition={current} goldCupWorldRanks={currentWorldRanks} />
          </div>
        ) : (
          <Panel>
            <Empty>
              No {confederation} Nations League edition has been drawn yet. Groups are drawn during the international window immediately before the competition begins.
            </Empty>
          </Panel>
        )
      )}

      {tab === "history" && (
        history.length === 0 ? (
          <Panel><Empty>No completed Nations League editions yet.</Empty></Panel>
        ) : (
          historyEdition && (
            <div className="space-y-4">
              <PromotionRelegationOverview
                edition={historyEdition}
                right={
                  <span className="inline-flex items-center gap-2">
                    <button
                      className="btn-ghost btn-sm"
                      aria-label="Older edition"
                      disabled={historyIndex >= history.length - 1}
                      onClick={() => setHistoryEditionId(history[historyIndex + 1]?.id ?? null)}
                    >
                      ‹
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      aria-label="Newer edition"
                      disabled={historyIndex <= 0}
                      onClick={() => setHistoryEditionId(history[historyIndex - 1]?.id ?? null)}
                    >
                      ›
                    </button>
                    <span>{seasonDisplay(historyEdition.year)}</span>
                    <span>Completed</span>
                  </span>
                }
              />
              <EditionTables edition={historyEdition} />
            </div>
          )
        )
      )}

      {tab === "divisionHistory" && (
        <DivisionHistory editions={editions} />
      )}
    </div>
  );
}
