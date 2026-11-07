import { useMemo } from "react";
import { useGame } from "../../store/gameStore";
import { getPlayersById } from "../../engine/players/lookup";
import { getPlayerName } from "../../engine/players/display";
import { getPredictedRanking, getStatLeaders } from "../../engine/international/editionInsights";
import type { CompetitionKey, CupEditionLike } from "../../engine/international/editionInsights";
import type { StatLeader } from "../../engine/international/types";
import { Empty, NationTag, Panel, PlayerLink } from "./common";
import { FlagIcon } from "./FlagIcon";

/** A finished edition's frozen predictions/stats, or live ones while it is in progress. */
function useInsights(competition: CompetitionKey, edition: CupEditionLike) {
  const game = useGame();
  const state = game.world.international;
  const playersById = getPlayersById(game.world.players);
  const finished = edition.completed && edition.predictedRanking !== undefined;
  // Live results change with every simulated match; frozen ones never do.
  const liveKey = finished ? 0 : game.version;
  const ranking = useMemo(() => getPredictedRanking(state, competition, edition), [state, competition, edition, liveKey]);
  const leaders = useMemo(() => getStatLeaders(state, competition, edition, playersById), [state, competition, edition, playersById, liveKey]);
  return { ranking, leaders, playersById };
}

/** Predicted final standings: every match is simulated from the draw using team overall (world ranking breaks ties). */
export function PredictionsTab(props: { competition: CompetitionKey; edition: CupEditionLike }) {
  const { ranking } = useInsights(props.competition, props.edition);
  let place = 0;
  return (
    <Panel title="Predicted results">
      <p className="px-4 py-2 text-xs text-navy-300">
        {props.edition.completed
          ? "The prediction made for this edition from team overalls (frozen once it finished)."
          : "Every match is simulated using team overall (world ranking breaks ties). Updates as team overalls change."}
      </p>
      <table className="tbl">
        {ranking.map(tier => (
          <tbody key={tier.label}>
            <tr><th colSpan={2} className="bg-navy-900 text-xs uppercase tracking-wider text-navy-300 !py-1.5">{tier.label}</th></tr>
            {tier.teams.map(code => (
              <tr key={code}>
                <td className="w-14 text-center tabular-nums text-navy-200">{++place}</td>
                <td><NationTag code={code} label="name" /></td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Panel>
  );
}

function LeaderPanel(props: { title: string; valueLabel: string; leaders: StatLeader[]; playersById: Map<string, { firstName: string; lastName: string; commonName: string | null }> }) {
  return (
    <Panel title={props.title}>
      {props.leaders.length === 0 ? <Empty>None yet.</Empty> : (
        <table className="tbl">
          <thead><tr><th className="w-10 text-center">#</th><th>Player</th><th className="num">GP</th><th className="num">{props.valueLabel}</th></tr></thead>
          <tbody>
            {props.leaders.map((leader, index) => {
              const player = props.playersById.get(leader.playerId);
              return (
                <tr key={leader.playerId}>
                  <td className="text-center tabular-nums text-navy-200">{index + 1}</td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <NationTag code={leader.nation} />
                      {player ? <PlayerLink id={leader.playerId} name={getPlayerName(player)} /> : <span className="text-navy-300">Unknown player</span>}
                    </span>
                  </td>
                  <td className="num text-navy-200">{leader.games}</td>
                  <td className="num font-semibold">{leader.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** Top 10 goals, assists and clean sheets (ties: fewer games, then player overall, then team world ranking). */
export function StatsTab(props: { competition: CompetitionKey; edition: CupEditionLike }) {
  const { leaders, playersById } = useInsights(props.competition, props.edition);
  return (
    <div className="grid gap-6 xl:grid-cols-3 md:grid-cols-2">
      <LeaderPanel title="Most goals" valueLabel="Goals" leaders={leaders.goals} playersById={playersById} />
      <LeaderPanel title="Most assists" valueLabel="Assists" leaders={leaders.assists} playersById={playersById} />
      <LeaderPanel title="Most clean sheets" valueLabel="Clean sheets" leaders={leaders.cleanSheets} playersById={playersById} />
    </div>
  );
}

/** The golden boot winner of an edition: "[flag] Player Name (N)". */
export function GoldenBoot(props: { competition: CompetitionKey; edition: CupEditionLike }) {
  const { leaders, playersById } = useInsights(props.competition, props.edition);
  const top = leaders.goals[0];
  const player = top && playersById.get(top.playerId);
  if (!top) return <span className="text-navy-400">–</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <FlagIcon code={top.nation} />
      {player ? <PlayerLink id={top.playerId} name={getPlayerName(player)} /> : <span className="text-navy-300">Unknown player</span>}
      <span className="text-navy-300">({top.value})</span>
    </span>
  );
}
