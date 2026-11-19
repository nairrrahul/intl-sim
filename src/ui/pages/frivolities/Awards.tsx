
import { useState } from "react";
import { useGameStore } from "../../../store/gameStore";
import {
  Empty,
  NationTag,
  OvrBadge,
  PageHeader,
  Panel,
  PlayerLink,
  PosBadge,
  Tabs
} from "../../components/common";

import type { YearlyAwardRecord } from "../../../engine/players/awards";

function getPlayerName(player: {
  commonName: string | null;
  firstName: string;
  lastName: string;
}): string {
  return player.commonName ||
    `${player.firstName} ${player.lastName}`;
}

type AwardTab = "goldenBoot" | "goldenGlove" | "youngTalent";

export default function Awards() {
  const [tab, setTab] = useState<AwardTab>("goldenBoot");
  const game = useGameStore(state => state.game);
  useGameStore(state => state.tick);

  if (!game) return null;

  const { yearlyAwards } = game.world;

  const getRows = (records: YearlyAwardRecord[]) =>
    [...records]
      .sort((a, b) => a.year - b.year)
      .flatMap(record => {
        const player = game.world.players.find(
          candidate => candidate.id === record.playerId
        );

        if (!player) return [];

        const season = player.progression.find(
          row => row.year === record.year
        );

        if (!season) return [];

        return [{
          year: record.year,
          player,
          season
        }];
      });

  const goldenBoot = getRows(yearlyAwards.goldenBoot);
  const goldenGlove = getRows(yearlyAwards.goldenGlove);
  const youngTalent = getRows(yearlyAwards.youngTalent);

  return (
    <div>
      <PageHeader
        title="Awards"
        subtitle="Individual awards from each completed season."
      />

      <Tabs
        tabs={[
          { id: "goldenBoot", label: "Golden Boot" },
          { id: "goldenGlove", label: "Golden Glove" },
          { id: "youngTalent", label: "Young Talent" }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "goldenBoot" && (
        <Panel title="Yearly Golden Boot">
          {goldenBoot.length === 0 ? (
            <Empty>No awards have been recorded yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="num">OVR</th>
                    <th>Nation</th>
                    <th className="num">Goals</th>
                  </tr>
                </thead>
                <tbody>
                  {goldenBoot.map(({ year, player, season }) => (
                    <tr key={year}>
                      <td className="tabular-nums">{year}-{(year+1)%100}</td>
                      <td>
                        <PlayerLink
                          id={player.id}
                          name={getPlayerName(player)}
                        />
                      </td>
                      <td><PosBadge position={player.position} /></td>
                      <td className="num">
                        <OvrBadge value={season.overall} />
                      </td>
                      <td>
                        <NationTag
                          code={player.primaryNationality}
                          label="name"
                        />
                      </td>
                      <td className="num font-bold">
                        {season.goals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === "goldenGlove" && (
        <Panel title="Yearly Golden Glove">
          {goldenGlove.length === 0 ? (
            <Empty>No awards have been recorded yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="num">OVR</th>
                    <th>Nation</th>
                    <th className="num">Clean Sheets</th>
                  </tr>
                </thead>
                <tbody>
                  {goldenGlove.map(({ year, player, season }) => (
                    <tr key={year}>
                      <td className="tabular-nums">{year}-{(year+1)%100}</td>
                      <td>
                        <PlayerLink
                          id={player.id}
                          name={getPlayerName(player)}
                        />
                      </td>
                      <td><PosBadge position={player.position} /></td>
                      <td className="num">
                        <OvrBadge value={season.overall} />
                      </td>
                      <td>
                        <NationTag
                          code={player.primaryNationality}
                          label="name"
                        />
                      </td>
                      <td className="num font-bold">
                        {season.cleanSheets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === "youngTalent" && (
        <Panel title="Young Talent of the Year">
          {youngTalent.length === 0 ? (
            <Empty>No awards have been recorded yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="num">OVR</th>
                    <th>Nation</th>
                  </tr>
                </thead>
                <tbody>
                  {youngTalent.map(({ year, player, season }) => (
                    <tr key={year}>
                      <td className="tabular-nums">{year}-{(year+1)%100}</td>
                      <td>
                        <PlayerLink
                          id={player.id}
                          name={getPlayerName(player)}
                        />
                      </td>
                      <td><PosBadge position={player.position} /></td>
                      <td className="num">
                        <OvrBadge value={season.overall} />
                      </td>
                      <td>
                        <NationTag
                          code={player.primaryNationality}
                          label="name"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
