import { useState } from "react";
import { formatWindowLabel } from "../../../engine/international/calendar/windows";
import { useGame } from "../../../store/gameStore";
import {
  Empty,
  NationLink,
  OvrBadge,
  PageHeader,
  Panel,
  Tabs
} from "../../components/common";
import type {
  MatchUpsetRecord,
  TournamentUpsetRecord
} from "../../../engine/international/types";
import { ordinal } from "../../format";
import { getCompetitionNameForKind, getFullCompetitionName } from "../../competitions";
import { Link } from "react-router-dom";
import { getLinkFromKind } from "../../../engine/international/nationViews";

type Tab = "winners" | "placings" | "ranking" | "rating";
type PlacingsTab = "combined" | "nonWorldCup";

function TournamentTable(props: {
  records: TournamentUpsetRecord[];
  showActual: boolean;
}) {
  if (props.records.length === 0) {
    return <Empty>No completed tournament records yet.</Empty>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th className="w-10 text-center">#</th>
            <th>Country</th>
            <th>Tournament</th>
            <th className="num">Expected Position</th>
            {props.showActual && <th className="num">Actual Position</th>}
            {props.showActual && <th className="num">Position Delta</th>}
            <th className="num">World Rank</th>
          </tr>
        </thead>
        <tbody>
          {props.records.map((record, index) => (
            <tr key={`${record.competition}-${record.year}-${record.code}`}>
              <td className="text-center tabular-nums">{index + 1}</td>
              <td><NationLink code={record.code} /></td>
              <td>{record.competition} {record.year + 1}</td>
              <td className="num">
                <span>{record.expectedStage}</span>
                <span className="ml-1 text-xs text-navy-200">
                  ({ordinal(record.expected)})
                </span>
              </td>
              {props.showActual &&
              <>
                <td className="num">
                  <span className="font-semibold">{record.actualStage}</span>
                  <span className="ml-1 text-xs text-navy-200">
                    ({ordinal(record.actual)})
                  </span>
                </td>
                <td className="num">
                  <span className={`font-semibold ${record.actual - record.expected > 0 ? "text-red-500" : "text-green-500"}`}>
                    {record.actual - record.expected > 0 ? "▼" : "▲"} {Math.abs(record.actual - record.expected)}
                  </span>
                </td>
                </>
              }
              <td className="num tabular-nums">{record.worldRank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchUpsetTable(props: {
  records: MatchUpsetRecord[];
  metric: "ranking" | "rating";
}) {
  if (props.records.length === 0) {
    return <Empty>No qualifying match upsets recorded yet.</Empty>;
  }

  const ranking = props.metric === "ranking";

  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Winner</th>
            <th className="num">{ranking ? "Ranking" : "Rating"}</th>
            <th className="num">Scoreline</th>
            <th>Loser</th>
            <th className="num">{ranking ? "Ranking" : "Rating"}</th>
            <th className="num">
              {ranking ? "Rank Difference" : "Rating Difference"}
            </th>
            <th>Window</th>
            <th>Competition</th>
          </tr>
        </thead>
        <tbody>
          {props.records.map((record, index) => {
            const winnerIsHome = record.winner === record.home;
            const winnerRank = winnerIsHome ? record.homeRank : record.awayRank;
            const loserRank = winnerIsHome ? record.awayRank : record.homeRank;
            const winnerRating = winnerIsHome ? record.homeOverall : record.awayOverall;
            const loserRating = winnerIsHome ? record.awayOverall : record.homeOverall;
            const winnerGoals = winnerIsHome ? record.homeGoals : record.awayGoals;
            const loserGoals = winnerIsHome ? record.awayGoals : record.homeGoals;

            return (
              <tr key={`${record.year}-${record.windowId}-${record.matchday}-${record.home}-${record.away}-${index}`}>
                <td><NationLink code={record.winner} /></td>
                <td className="num tabular-nums">
                  {ranking ? `${winnerRank}` : <OvrBadge value={winnerRating} />}
                </td>
                <td className="num tabular-nums font-semibold">
                  {winnerGoals}–{loserGoals}
                </td>
                <td><NationLink code={record.loser} /></td>
                <td className="num tabular-nums">
                  {ranking ? `${loserRank}` : <OvrBadge value={loserRating} />}
                </td>
                <td className="num tabular-nums font-semibold">
                  {ranking ? record.rankingDifference : record.ratingDifference}
                </td>
                <td className="whitespace-nowrap">
                  {formatWindowLabel(record.year, record.windowId)}
                </td>
                <td className="whitespace-nowrap">
                  <Link to={getLinkFromKind(record.kind, record.winner, record.worldCupPhase, record.worldCupStage)} className="link"> 
                    {getFullCompetitionName(getCompetitionNameForKind(record.kind), record.winner)}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Upsets() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("winners");
  const [placingsTab, setPlacingsTab] = useState<PlacingsTab>("combined");
  const history = game.world.international.upsets;

  return (
    <div>
      <PageHeader
        title="Upsets"
        subtitle="The most unexpected results in international football."
      />

      <Tabs
        tabs={[
          { id: "winners", label: "Unexpected Tournament Winners" },
          { id: "placings", label: "Unexpected Tournament Placings" },
          { id: "ranking", label: "World Ranking Upsets" },
          { id: "rating", label: "Team Rating Upsets" }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "winners" && (
        <Panel title="Most Unexpected Tournament Winners">
          <TournamentTable records={history.tournamentWinners} showActual={false} />
        </Panel>
      )}

      {tab === "placings" && (
        <div>
          <Tabs
            tabs={[
              { id: "combined", label: "Combined" },
              { id: "nonWorldCup", label: "Non-World Cup" }
            ]}
            value={placingsTab}
            onChange={setPlacingsTab}
          />
          <Panel title="Most Unexpected Tournament Placings">
            {placingsTab === "combined" && (
              <TournamentTable
                records={history.tournamentPlacings}
                showActual
              />
            )}

            {placingsTab === "nonWorldCup" && (
              <TournamentTable
                records={history.nonWorldCupTournamentPlacings ?? []}
                showActual
              />
            )}
          </Panel>
        </div>
        
      )}

      {tab === "ranking" && (
        <Panel title="Biggest Match Upsets — World Ranking">
          <MatchUpsetTable records={history.ranking} metric="ranking" />
        </Panel>
      )}

      {tab === "rating" && (
        <Panel title="Biggest Match Upsets — Team Rating">
          <MatchUpsetTable records={history.rating} metric="rating" />
        </Panel>
      )}
    </div>
  );
}
