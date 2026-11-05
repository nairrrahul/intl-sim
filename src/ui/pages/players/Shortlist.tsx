import { getPlayerName } from "../../../engine/players/display";
import { useState } from "react";
import { useGame } from "../../../store/gameStore";
import type { Player } from "../../../engine/players/types";
import { getNationName } from "../../../engine/nations/nations";
import { POSITION_ORDER } from "../../../engine/players/positions";
import {
  Empty, NationTag, OvrBadge, PageHeader, Panel, PlayerLink, PosBadge, ShortlistButton, SortTh, Tabs,
  compareSortValues, RetiringMark } from "../../components/common";
import type { SortState } from "../../components/common";

type ShortlistTab = "active" | "retired";
type Key = "pos" | "name" | "age" | "ovr" | "pot" | "nat" | "sec" | "caps";
const DESC_FIRST: Key[] = ["ovr", "pot", "caps"];

function sortValue(player: Player, key: Key): string | number | null {
  switch (key) {
    case "pos": return POSITION_ORDER.indexOf(player.position);
    case "name": return getPlayerName(player);
    case "age": return player.age;
    case "ovr": return player.overall;
    case "pot": return player.potential;
    case "nat": return getNationName(player.primaryNationality);
    case "sec": return player.secondaryNationality ? getNationName(player.secondaryNationality) : null;
    case "caps": return player.caps;
  }
}

export default function Shortlist() {
  const game = useGame();
  const [sort, setSort] = useState<SortState>({ key: "ovr", dir: "desc" });
  const [tab, setTab] = useState<ShortlistTab>("active");

  const shortlisted = game.world.players.filter(player => player.isShortlisted);
  const activeCount = shortlisted.filter(player => !player.isRetired).length;
  const retiredCount = shortlisted.length - activeCount;
  const players = shortlisted.filter(player => player.isRetired === (tab === "retired"));
  const rows = [...players].sort((a, b) =>
    compareSortValues(sortValue(a, sort.key as Key), sortValue(b, sort.key as Key), sort.dir) || b.overall - a.overall
  );

  const onSort = (key: string) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else setSort({ key, dir: DESC_FIRST.includes(key as Key) ? "desc" : "asc" });
  };
  const dir = (key: Key) => (sort.key === key ? sort.dir : null);

  return (
    <div>
      <PageHeader title="Shortlist" subtitle={`${shortlisted.length} player${shortlisted.length === 1 ? "" : "s"}`} />
      <p className="text-sm text-navy-300 mb-4 max-w-3xl">
        Use the flag icon next to a player to add or remove them from your shortlist.
      </p>

      <Tabs
        tabs={[
          { id: "active", label: `Active (${activeCount})` },
          { id: "retired", label: `Retired (${retiredCount})` }
        ]}
        value={tab}
        onChange={setTab}
      />

      <Panel title={tab === "active" ? "Shortlisted players" : "Retired players"}>
        {rows.length === 0 ? (
          <Empty>{tab === "active"
            ? "No active players on your shortlist. Click the flag icon on a player to add them."
            : "None of your shortlisted players have retired."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <SortTh label="Pos" sortKey="pos" dir={dir("pos")} onSort={onSort} />
                  <SortTh label="Name" sortKey="name" dir={dir("name")} onSort={onSort} />
                  <SortTh label="Age" sortKey="age" dir={dir("age")} onSort={onSort} className="num" />
                  <SortTh label="OVR" sortKey="ovr" dir={dir("ovr")} onSort={onSort} className="num" />
                  <SortTh label="POT" sortKey="pot" dir={dir("pot")} onSort={onSort} className="num" />
                  <SortTh label="Nationality" sortKey="nat" dir={dir("nat")} onSort={onSort} />
                  <SortTh label="Secondary" sortKey="sec" dir={dir("sec")} onSort={onSort} />
                  <SortTh label="Caps" sortKey="caps" dir={dir("caps")} onSort={onSort} className="num" />
                </tr>
              </thead>
              <tbody>
                {rows.map(player => (
                  <tr key={player.id}>
                    <td><ShortlistButton playerId={player.id} shortlisted /></td>
                    <td><PosBadge position={player.position} /></td>
                    <td><PlayerLink id={player.id} name={getPlayerName(player)} /><RetiringMark player={player} seasonYear={game.world.year} /></td>
                    <td className="num">{player.age}</td>
                    <td className="num"><OvrBadge value={player.overall} /></td>
                    <td className="num text-navy-200">{player.potential}</td>
                    <td><NationTag code={player.primaryNationality} /></td>
                    <td>{player.secondaryNationality ? <NationTag code={player.secondaryNationality} muted /> : <span className="text-navy-400">–</span>}</td>
                    <td className="num">{player.caps}</td>
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
