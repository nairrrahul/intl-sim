
import { useGame } from "../../../store/gameStore";
import {
  Empty,
  NationLink,
  PageHeader,
  Panel
} from "../../components/common";
import type {
  MatchUpsetRecord,
  TournamentUpsetRecord
} from "../../../engine/international/types";

function TournamentWinnerTable(props: {
  records: TournamentUpsetRecord[];
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
            <th className="num">World Rank</th>
          </tr>
        </thead>
        <tbody>
          {props.records.map((record, index) => (
            <tr key={`${record.competition}-${record.year}-${record.code}`}>
              <td className="text-center tabular-nums">{index + 1}</td>
              <td>
                <NationLink code={record.code} />
              </td>
              <td>
                {record.competition} {record.year}
              </td>
              <td className="num tabular-nums">
                {record.expected}
              </td>
              <td className="num tabular-nums">
                {record.worldRank}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TournamentPlacementTable(props: {
  records: TournamentUpsetRecord[];
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
            <th className="num">Actual Position</th>
            <th className="num">World Rank</th>
          </tr>
        </thead>
        <tbody>
          {props.records.map((record, index) => (
            <tr key={`${record.competition}-${record.year}-${record.code}`}>
              <td className="text-center tabular-nums">{index + 1}</td>
              <td>
                <NationLink code={record.code} />
              </td>
              <td>
                {record.competition} {record.year}
              </td>
              <td className="num tabular-nums">
                {record.expected}
              </td>
              <td className="num tabular-nums font-semibold">
                {record.actual}
              </td>
              <td className="num tabular-nums">
                {record.worldRank}
              </td>
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
            <th className="w-10 text-center">#</th>
            <th>Winner</th>
            <th>Match</th>
            <th className="num">Score</th>
            <th className="num">
              {ranking ? "Rank Difference" : "Rating Difference"}
            </th>
            <th className="num">
              {ranking ? "World Rankings" : "Team Ratings"}
            </th>
          </tr>
        </thead>
        <tbody>
          {props.records.map((record, index) => (
            <tr
              key={`${record.year}-${record.windowId}-${record.matchday}-${record.home}-${record.away}`}
            >
              <td className="text-center tabular-nums">
                {index + 1}
              </td>
              <td>
                <NationLink code={record.winner} />
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <NationLink code={record.home} />
                  <span className="text-navy-400">vs</span>
                  <NationLink code={record.away} />
                </div>
                <div className="text-xs text-navy-400 mt-0.5">
                  {record.year} · {record.windowId}
                </div>
              </td>
              <td className="num tabular-nums">
                {record.homeGoals}–{record.awayGoals}
              </td>
              <td className="num tabular-nums font-semibold">
                {ranking
                  ? record.rankingDifference
                  : record.ratingDifference}
              </td>
              <td className="num tabular-nums">
                {ranking
                  ? `${record.homeRank}–${record.awayRank}`
                  : `${record.homeOverall}–${record.awayOverall}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Upsets() {
  const game = useGame();
  const history = game.world.international.upsets;

  return (
    <div>
      <PageHeader
        title="Upsets"
        subtitle="The most unexpected results in international football."
      />

      <div className="space-y-4">
        <Panel title="Most Unexpected Tournament Winners">
          <TournamentWinnerTable
            records={history.tournamentWinners}
          />
        </Panel>

        <Panel title="Most Unexpected Tournament Placings">
          <TournamentPlacementTable
            records={history.tournamentPlacings}
          />
        </Panel>

        <Panel title="Biggest Match Upsets — World Ranking">
          <MatchUpsetTable
            records={history.ranking}
            metric="ranking"
          />
        </Panel>

        <Panel title="Biggest Match Upsets — Team Rating">
          <MatchUpsetTable
            records={history.rating}
            metric="rating"
          />
        </Panel>
      </div>
    </div>
  );
}
