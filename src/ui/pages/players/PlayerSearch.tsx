import { computeVirtualWindow } from "../../virtualWindow";
import { getPlayerName } from "../../../engine/players/display";
import { useEffect, useMemo, useRef, useState } from "react";
import { POSITION_ORDER } from "../../../engine/players/positions";
import { getNationName, nationInfo } from "../../../engine/nations/nations";
import { useGame, useGameStore } from "../../../store/gameStore";
import {
  Empty, NationTag, OvrBadge, PageHeader, Panel, PlayerLink, PosBadge, RetiringMark } from "../../components/common";

interface SearchFilters {
  name: string;
  nationality: string;
  position: string;
  overallMin: string;
  overallMax: string;
  potentialMin: string;
  potentialMax: string;
  ageMin: string;
  ageMax: string;
}

const EMPTY_FILTERS: SearchFilters = {
  name: "",
  nationality: "",
  position: "",
  overallMin: "",
  overallMax: "",
  potentialMin: "",
  potentialMax: "",
  ageMin: "",
  ageMax: ""
};

const ROW_HEIGHT = 38;
const OVERSCAN = 8;
const VIRTUALIZE_AFTER = 100;
/** Used until the scroll container has been measured (and if a measurement ever comes back empty). */
const DEFAULT_VIEWPORT_HEIGHT = 560;

function withinRange(value: number, min: string, max: string): boolean {
  return (min === "" || value >= Number(min)) && (max === "" || value <= Number(max));
}

export default function PlayerSearch() {
  const game = useGame();
  const tick = useGameStore(state => state.tick);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => game.world.players.filter(player => !player.isRetired), [game, tick]);
  const nationalityOptions = useMemo(() =>
    Object.values(nationInfo)
      .map(nation => nation.threeLetterCode)
      .sort((a, b) => getNationName(a).localeCompare(getNationName(b))),
  []);

  const rows = useMemo(() => {
    const query = filters.name.trim().toLocaleLowerCase();
    return entries.filter(entry => {
      const player = entry;
      const fullName = `${player.firstName} ${player.lastName} ${player.commonName ?? ""}`.toLocaleLowerCase();
      const reverseName = `${player.lastName} ${player.firstName}`.toLocaleLowerCase();
      const matchesName = !query || fullName.includes(query) || reverseName.includes(query);
      const matchesNationality = !filters.nationality ||
        player.primaryNationality === filters.nationality;
      const matchesPosition = !filters.position || player.position === filters.position;
      return matchesName && matchesNationality && matchesPosition &&
        withinRange(player.overall, filters.overallMin, filters.overallMax) &&
        withinRange(player.potential, filters.potentialMin, filters.potentialMax) &&
        withinRange(player.age, filters.ageMin, filters.ageMax);
    }).sort((a, b) =>
      b.overall - a.overall ||
      b.potential - a.potential ||
      a.age - b.age ||
      getPlayerName(a).localeCompare(
        getPlayerName(b),
        undefined,
        { sensitivity: "base" }
      )
    );
  }, [entries, filters]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    // The scroll container stays mounted even when no players match, so this observer never goes stale.
    const measure = () => setViewportHeight(element.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    measure();
    return () => resizeObserver.disconnect();
  }, []);

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [filterKey]);

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
  };
  const { virtualized, firstRow, visibleCount } = computeVirtualWindow({
    rowCount: rows.length,
    rowHeight: ROW_HEIGHT,
    scrollTop,
    viewportHeight,
    overscan: OVERSCAN,
    virtualizeAfter: VIRTUALIZE_AFTER
  });
  const visibleRows = rows.slice(firstRow, firstRow + visibleCount);
  const bottomRows = Math.max(0, rows.length - firstRow - visibleRows.length);

  return (
    <div>
      <PageHeader
        title="Player Search"
        subtitle={`${rows.length.toLocaleString()} of ${entries.length.toLocaleString()} players`}
      />

      <Panel title="Filters" right={
        <button className="btn-ghost btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
      }>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
          <label className="text-xs text-navy-300">
            Name
            <input
              className="input mt-1 w-full"
              type="search"
              placeholder="Search name"
              value={filters.name}
              onChange={event => updateFilter("name", event.target.value)}
            />
          </label>
          <label className="text-xs text-navy-300">
            Nationality
            <select className="input mt-1 w-full" value={filters.nationality} onChange={event => updateFilter("nationality", event.target.value)}>
              <option value="">All nationalities</option>
              {nationalityOptions.map(code => <option key={code} value={code}>{getNationName(code)}</option>)}
            </select>
          </label>
          <label className="text-xs text-navy-300">
            Position
            <select className="input mt-1 w-full" value={filters.position} onChange={event => updateFilter("position", event.target.value)}>
              <option value="">All positions</option>
              {POSITION_ORDER.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
          </label>
          <RangeFilter label="Overall" min={filters.overallMin} max={filters.overallMax}
            onMinChange={value => updateFilter("overallMin", value)}
            onMaxChange={value => updateFilter("overallMax", value)} />
          <RangeFilter label="Potential" min={filters.potentialMin} max={filters.potentialMax}
            onMinChange={value => updateFilter("potentialMin", value)}
            onMaxChange={value => updateFilter("potentialMax", value)} />
          <RangeFilter label="Age" min={filters.ageMin} max={filters.ageMax}
            onMinChange={value => updateFilter("ageMin", value)}
            onMaxChange={value => updateFilter("ageMax", value)} />
        </div>
      </Panel>

      <Panel className="mt-6">
        <div
          ref={scrollRef}
          className="max-h-[70vh] min-h-[320px] overflow-auto"
          onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        >
          {rows.length === 0 ? <Empty>No players match these filters.</Empty> : (
            <table className="tbl min-w-[760px] border-collapse">
              <thead className="sticky top-0 z-10 bg-navy-800">
                <tr>
                  <th>Pos</th><th>Name</th><th className="num">Age</th><th className="num">OVR</th>
                  <th className="num">POT</th><th>Nationality</th><th>Secondary</th><th className="num">Caps</th>
                </tr>
              </thead>
              <tbody>
                {virtualized && firstRow > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={8} className="p-0 border-0" style={{ height: firstRow * ROW_HEIGHT, padding: 0, border: 0 }} />
                  </tr>
                )}
                {visibleRows.map(player => (
                  <tr key={player.id} style={virtualized ? { height: ROW_HEIGHT } : undefined}>
                    <td><PosBadge position={player.position} /></td>
                    <td><PlayerLink id={player.id} name={getPlayerName(player)} /><RetiringMark player={player} seasonYear={game.world.year} /></td>
                    <td className="num">{player.age}</td>
                    <td className="num"><OvrBadge value={Math.round(player.overall)} /></td>
                    <td className="num"><OvrBadge value={Math.round(player.potential)} /></td>
                    <td><NationTag code={player.primaryNationality} /></td>
                    <td><NationTag code={player.secondaryNationality} muted /></td>
                    <td className="num">{player.caps}</td>
                  </tr>
                ))}
                {virtualized && bottomRows > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={8} className="p-0 border-0" style={{ height: bottomRows * ROW_HEIGHT, padding: 0, border: 0 }} />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

function RangeFilter(props: {
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  return (
    <fieldset className="text-xs text-navy-300">
      <legend>{props.label}</legend>
      <div className="flex gap-2 mt-1">
        <input
          className="input min-w-0 w-full"
          type="number"
          aria-label={`${props.label} minimum`}
          placeholder="Min"
          value={props.min}
          onChange={event => props.onMinChange(event.target.value)}
        />
        <input
          className="input min-w-0 w-full"
          type="number"
          aria-label={`${props.label} maximum`}
          placeholder="Max"
          value={props.max}
          onChange={event => props.onMaxChange(event.target.value)}
        />
      </div>
    </fieldset>
  );
}
