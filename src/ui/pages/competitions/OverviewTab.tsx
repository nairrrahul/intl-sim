
import { useMemo } from "react";
import { useGame } from "../../../store/gameStore";
import { getWorldRankings } from "../../../engine/queries";
import { getConfederation, getNationName } from "../../../engine/nations/nations";
import { getNationMatches } from "../../../engine/international/nationViews";
import { getPlayerName } from "../../../engine/players/display";
import type { Player } from "../../../engine/players/types";
import {
  Empty,
  NationLink,
  OvrBadge,
  Panel,
  PlayerLink,
  PosBadge,
  RetiringMark,
  Stat
} from "../../components/common";
import { FlagIcon } from "../../components/FlagIcon";
import { YouthRatingInput } from "../../components/YouthRatingInput";
import {
  getCompetitionNameForKind,
  getFullCompetitionName
} from "../../competitions";
import NationKits from "./NationKits";

type Props = {
  code: string;
};

function YouthRatingStat({ code }: { code: string }) {
  const game = useGame();

  return (
    <Stat
      label="Youth rating"
      value={
        <span className="inline-flex items-baseline gap-1">
          <YouthRatingInput code={code} />
          <span className="text-xs font-normal text-navy-300">/200</span>
        </span>
      }
      sub={game.world.godMode ? "0-200 · God Mode" : "Drives newgen quality"}
    />
  );
}

function UpcomingMatch({ code }: { code: string }) {
  const game = useGame();

  const match = useMemo(
    () =>
      getNationMatches(
        game.world.international,
        code,
        game.world.year,
        { team: "senior", version: game.version }
      ).find(row => row.scheduled) ?? null,
    [
      game.world.international,
      game.world.year,
      game.version,
      code
    ]
  );

  if (!match) {
    return (
      <Empty>No upcoming senior matches scheduled.</Empty>
    );
  }

  const homeCode = match.home ? code : match.opponent;
  const awayCode = match.home ? match.opponent : code;

  const competitionName = getFullCompetitionName(
    getCompetitionNameForKind(match.kind),
    code
  );

  return (
    <div className="flex items-center justify-around gap-4 px-5 py-8 min-h-[250px]">

      {/* Home team */}
      <div className="flex flex-1 flex-col items-center gap-3 min-w-0">
        <FlagIcon code={homeCode} size={7} />
        <span className="text-lg font-bold text-center">
          <NationLink code={getNationName(homeCode)} hasFlag={false} />
        </span>
      </div>

      {/* Competition and window */}
      <div className="flex flex-col items-center text-center shrink-0 gap-1">
        <span className="text-4xl font-bold text-navy-300">
          V
        </span>

        <span className="text-sm font-semibold mt-2">
          {competitionName}
        </span>

        <span className="text-xs uppercase tracking-wider text-navy-300">
          {match.windowLabel}
        </span>
      </div>

      {/* Away team */}
      <div className="flex flex-1 flex-col items-center gap-3 min-w-0">
        <FlagIcon code={awayCode} size={7} />
        <span className="text-lg font-bold text-center">
          <NationLink code={getNationName(awayCode)} hasFlag={false} />
        </span>
      </div>

    </div>
  );
}

function OverviewPlayerTable({
  title,
  players,
  year
}: {
  title: string;
  players: Player[];
  year: number;
}) {
  return (
    <Panel title={title}>
      {players.length === 0 ? (
        <Empty>No players available.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>OVR</th>
                <th>Name</th>
                <th className="num">Age</th>
                <th className="num">Pos</th>
              </tr>
            </thead>

            <tbody>
              {players.map(player => (
                <tr key={player.id}>
                  <td>
                    <OvrBadge value={player.overall} />
                  </td>

                  <td>
                    <PlayerLink
                      id={player.id}
                      name={getPlayerName(player)}
                    />
                    <RetiringMark
                      player={player}
                      seasonYear={year}
                    />
                  </td>

                  <td className="num tabular-nums">
                    {player.age}
                  </td>

                  <td className="num">
                    <PosBadge position={player.position} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function OverviewTab({ code }: Props) {
  const game = useGame();

  const nation = game.world.international.nations[code];
  const confederation = getConfederation(code) ?? "Unknown";

  // World ranking and squad overall ranking.
  const { points, overall } = getWorldRankings(game);

  const rank = points.find(row => row.code === code)?.rank ?? 0;
  const overallRank = overall.find(row => row.code === code)?.rank ?? 0;

  // All active players whose primary nationality is this nation.
  const nationPlayers = game.world.players
    .filter(
      player =>
        !player.isRetired &&
        player.primaryNationality === code
    );

  // Best players: highest current overall, then potential.
  const bestPlayers = [...nationPlayers]
    .sort(
      (a, b) =>
        b.overall - a.overall ||
        b.potential - a.potential
    )
    .slice(0, 6);

  // Hot prospects: highest weighted overall/potential score.
  const hotProspects = nationPlayers
    .filter(player => player.age < 20)
    .sort(
      (a, b) =>
        (
          0.4 * b.overall + 0.6 * b.potential
        ) - (
          0.4 * a.overall + 0.6 * a.potential
        ) ||
        b.potential - a.potential ||
        b.overall - a.overall ||
        a.age - b.age ||
        getPlayerName(a).localeCompare(getPlayerName(b))
    )
    .slice(0, 6);

  return (
    <div className="space-y-5">

      {/* ROW 1: NATIONAL STATISTICS */}
      <Panel>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-navy-700">

          <div className="p-5">
            <Stat
              label="World ranking"
              value={`#${rank}`}
              sub={`of ${points.length}`}
            />
          </div>

          <div className="p-5">
            <Stat
              label="Ranking points"
              value={nation.points.toFixed(2)}
            />
          </div>

          <div className="p-5">
            <Stat
              label="Squad overall"
              value={<OvrBadge value={nation.overall} size="lg" />}
              sub={`${nation.formation} · #${overallRank} by overall`}
            />
          </div>

          <div className="p-5">
            <Stat
              label="Confederation"
              value={confederation}
              sub={`${nationPlayers.length} players in the game`}
            />
          </div>

          <div className="p-5">
            <YouthRatingStat code={code} />
          </div>

        </div>
      </Panel>

      {/* ROW 2: KITS AND NEXT MATCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        <div className="lg:col-span-5">
          <Panel title="Kits">
            <NationKits code={code} />
          </Panel>
        </div>

        <div className="lg:col-span-7">
          <Panel title="Next match">
            <UpcomingMatch code={code} />
          </Panel>
        </div>

      </div>

      {/* ROW 3: BEST PLAYERS AND HOT PROSPECTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <OverviewPlayerTable
          title="Best players"
          players={bestPlayers}
          year={game.world.year}
        />

        <OverviewPlayerTable
          title="Hot prospects"
          players={hotProspects}
          year={game.world.year}
        />

      </div>

    </div>
  );
}
