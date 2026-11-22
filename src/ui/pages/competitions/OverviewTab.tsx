
import { useMemo } from "react";
import { useGame } from "../../../store/gameStore";
import { getWorldRankings } from "../../../engine/queries";
import { getConfederation, getNationCodeByName, getNationName } from "../../../engine/nations/nations";
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
import { getFormationRequirements } from "../../../engine/players/formations";

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
  const homeCountryName = getNationName(homeCode);
  const awayCode = match.home ? match.opponent : code;
  const awayCountryName = getNationName(awayCode);

  const competitionName = getFullCompetitionName(
    getCompetitionNameForKind(match.kind),
    code
  );

  const stage = match.stage;

  const stageSeparator = stage?.indexOf("·") ?? -1;

  const stageTitle = stageSeparator >= 0
    ? stage!.slice(0, stageSeparator).trim()
    : stage;

  const stageDetail = stageSeparator >= 0
    ? stage!.slice(stageSeparator + 1).trim()
    : null;

  return (
    <div className="flex items-center justify-around gap-4 px-5 py-8 min-h-[250px]">

      {/* Home team */}
      <div className="flex flex-1 flex-col items-center gap-3 min-w-0">
        <FlagIcon code={homeCode} size={7} />
        <span className="text-lg font-bold text-center">
          <NationLink code={getNationCodeByName(homeCountryName) ?? homeCountryName} hasFlag={false} />
        </span>
      </div>

      {/* Competition and window */}
      <div className="flex flex-col items-center text-center shrink-0 gap-1">
        <span className="text-4xl font-bold text-navy-300">
          V
        </span>

        <div className="flex flex-col items-center text-center mt-2">
          {stage ? (
            <>
              <span className="text-sm font-semibold">
                {stageTitle}
              </span>

              {stageDetail && (
                <span className="text-xs text-navy-300">
                  {stageDetail}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold">
              {competitionName}
            </span>
          )}
        </div>

        <span className="text-xs uppercase tracking-wider text-navy-300">
          {match.windowLabel}
        </span>
      </div>

      {/* Away team */}
      <div className="flex flex-1 flex-col items-center gap-3 min-w-0">
        <FlagIcon code={awayCode} size={7} />
        <span className="text-lg font-bold text-center">
          <NationLink code={getNationCodeByName(awayCountryName) ?? awayCountryName} hasFlag={false} />
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

  const playersById = new Map(game.world.players.map(player => [player.id, player]));
  const startingXI = nation.startingXI
    .map(id => id ? playersById.get(id) ?? null : null);

  const formationPositions = getFormationRequirements(nation.formation);

  const getPositionOverall = (positions: string[]) => {
    const players = startingXI.filter(
      (player, index) =>
        player !== null && positions.includes(formationPositions[index])
    );

    if (players.length === 0) return "—";

    return Math.round(
      players.reduce((total, player) => total + (player ? player.overall : 0), 0) / players.length
    );
  };

  const attackOverall = getPositionOverall(["ST", "RW", "LW"]);
  const midfieldOverall = getPositionOverall(["CDM", "CM", "CAM", "RM", "LM"]);
  const defenseOverall = getPositionOverall(["RB", "CB", "LB"]);

  return (
    <div className="space-y-5">

      {/* ROW 1: NATIONAL STATISTICS */}
<Panel>
  <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_2fr_1fr_1fr]">
    {/* World Ranking */}
      <div className="p-4 md:px-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-navy-300">
          World Ranking
        </div>
        <div className="mt-1.5 text-2xl font-bold text-white">
          #{rank}
          <span className="ml-1.5 text-xs font-medium text-navy-300">
            of 211
          </span>
        </div>
      </div>

      {/* Ranking Points */}
      <div className="border-l border-navy-700 p-4 md:px-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-navy-300">
          Ranking Points
        </div>
        <div className="mt-1.5 text-2xl font-bold text-white">
          {nation.points.toFixed(2)}
        </div>
      </div>

      {/* Squad Overall + positional breakdown */}
      <div className="col-span-2 flex items-center gap-3 border-t border-navy-700 p-4 md:col-span-1 md:border-l md:border-t-0 md:px-5">
        <OvrBadge value={nation.overall} size="lg" />

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-navy-300">
            Squad Overall
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {nation.formation}
          </div>
          <div className="mt-0.5 text-xs text-navy-300">
            #{overallRank} by overall
          </div>
        </div>

        <div className="m-auto flex shrink-0 gap-2.5 border-l border-navy-700 pl-3">
          {[
            { label: "ATK", value: attackOverall },
            { label: "MID", value: midfieldOverall },
            { label: "DEF", value: defenseOverall },
          ].map(item => (
            <div key={item.label}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-navy-300">
                {item.label}
              </div>
              <div className="mt-1.5">
                {typeof item.value === "number" ? (
                  <OvrBadge value={item.value} size="m" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-700 text-sm font-bold text-navy-300">
                    —
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confederation */}
      <div className="border-t border-navy-700 p-4 md:border-l md:border-t-0 md:px-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-navy-300">
          Confederation
        </div>
        <div className="mt-1.5 text-2xl font-bold text-white">
          {confederation}
        </div>
        <div className="mt-1 text-xs text-navy-300">
          {nationPlayers.length} players in the game
        </div>
      </div>

      {/* Youth Rating */}
      <div className="border-l border-t border-navy-700 p-4 md:border-t-0 md:px-5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-navy-300">
          Youth Rating
        </div>
        <div className="mt-1.5 text-2xl font-bold text-white">
          <YouthRatingInput code={code} />
          <span className="ml-1 text-xs font-medium text-navy-300">/200</span>
        </div>
        <div className="mt-1 text-xs text-navy-300">
          Drives Newgen Quality
        </div>
      </div>

    </div>
  </Panel>



      {/* ROW 2: KITS AND NEXT MATCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        <div className="lg:col-span-5">
          <Panel title="Kits" className="h-full">
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
