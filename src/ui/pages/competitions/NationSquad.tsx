import { useGame, useGameStore } from "../../../store/gameStore";
import { FORMATIONS, getFormationLayoutSlots, getFormationRequirements } from "../../../engine/players/formations";
import { getPlayerName } from "../../../engine/players/display";
import { SUBSTITUTE_COUNT, getU20Candidates, getViableFormations } from "../../../engine/international/squads";
import type { Player } from "../../../engine/players/types";
import { Empty, OvrBadge, Panel, PlayerLink, PosBadge } from "../../components/common";

const shortName = (player: Player): string => player.commonName || player.lastName;

function Pitch(props: { formation: string; slots: (Player | null)[] }) {
  const requirements = getFormationRequirements(props.formation);
  const rows = getFormationLayoutSlots(props.formation);
  return (
    <div className="relative bg-navy-900 border-2 border-navy-500 rounded-xl px-3 py-6 min-h-[34rem] flex flex-col justify-around">
      {/* Pitch markings */}
      <div className="absolute inset-x-0 top-1/2 border-t-2 border-navy-600 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy-600 pointer-events-none" />
      <div className="absolute left-1/2 top-0 w-48 h-16 -translate-x-1/2 border-2 border-t-0 border-navy-600 pointer-events-none" />
      <div className="absolute left-1/2 bottom-0 w-48 h-16 -translate-x-1/2 border-2 border-b-0 border-navy-600 pointer-events-none" />
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="relative flex justify-around items-start">
          {row.map(slotIndex => {
            const player = props.slots[slotIndex];
            return (
              <div key={slotIndex} className="flex flex-col items-center w-24">
                <span className="rounded-full">
                  {player ? <OvrBadge value={player.overall} size="lg" /> : (
                    <span className="inline-flex w-12 h-12 items-center justify-center rounded-lg bg-navy-700 text-navy-300 text-xl">?</span>
                  )}
                </span>
                <span className="mt-1 text-[11px] font-semibold leading-tight text-center truncate w-full">
                  {player ? <PlayerLink id={player.id} name={shortName(player)} /> : "Empty"}
                </span>
                <span className="text-[10px] text-navy-300">
                  {requirements[slotIndex]}{player && player.position !== requirements[slotIndex] ? ` (${player.position})` : ""}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A nation's formation, starting XI and substitutes (senior or U20). Formations can only be changed in God Mode. */
export default function NationSquad(props: { code: string; team?: "senior" | "u20" }) {
  const team = props.team ?? "senior";
  const game = useGame();
  const setFormation = useGameStore(s => s.godSetFormation);
  const resetFormation = useGameStore(s => s.godResetFormation);
  const nation = game.world.international.nations[props.code];
  const squadState = team === "senior" ? nation : nation.u20;
  const godMode = game.world.godMode;

  const playersById = new Map(game.world.players.map(player => [player.id, player]));
  const slots = squadState.startingXI.map(id => (id ? playersById.get(id) ?? null : null));
  const substitutes = squadState.substitutes.flatMap(id => playersById.get(id) ?? []);
  const activePlayers = game.world.players.filter(player => !player.isRetired && player.primaryNationality === props.code);
  const viable = new Map(getViableFormations(team === "senior" ? activePlayers : getU20Candidates(activePlayers, nation))
    .map(option => [option.formation, option.overall]));
  const complete = slots.every(Boolean);

  if (team === "u20" && !nation.u20.formed) {
    return (
      <Panel title="U20 Squad">
        <Empty>
          <span className="font-semibold">U20 Squad Cannot be Formed</span>
          <span className="block text-sm text-navy-300 mt-1">
            It needs players aged 20 or under, outside the senior squad, who can fill a full formation and a bench of {SUBSTITUTE_COUNT}.
          </span>
        </Empty>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Panel
          title="Formation"
          right={
            <span className="flex items-center gap-3 text-navy-300">
              {godMode && squadState.formationLocked && (
                <button className="btn-ghost btn-sm" onClick={() => resetFormation(props.code, team)}>Back to automatic</button>
              )}
              <span>Team OVR <b className="text-white">{squadState.overall}</b></span>
            </span>
          }
        >
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.keys(FORMATIONS).map(formation => {
              const preview = viable.get(formation) ?? null;
              const active = squadState.formation === formation;
              const selectable = godMode && preview !== null && !active;
              return (
                <button
                  key={formation}
                  disabled={!selectable}
                  onClick={() => setFormation(props.code, formation, team)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    active ? "bg-accent-purple border-accent-purple-light"
                    : preview === null ? "bg-navy-900 border-navy-700 opacity-50 cursor-not-allowed"
                    : selectable ? "bg-navy-900 border-navy-600 hover:border-accent-purple"
                    : "bg-navy-900 border-navy-700 cursor-default"
                  }`}
                >
                  <div className="font-semibold">{formation}</div>
                  <div className="text-xs text-navy-200">{preview === null ? "Unavailable" : `Best XI OVR ${preview}`}</div>
                </button>
              );
            })}
          </div>
          <p className="px-4 pb-4 text-xs text-navy-300">
            {squadState.formationLocked
              ? "This formation was set manually (God Mode)."
              : "The formation with the highest-rated starting XI is chosen automatically."}
            {!godMode && " Enable God Mode to choose a different one."}
          </p>
        </Panel>

        <Pitch formation={squadState.formation} slots={slots} />
        {!complete && (
          <p className="text-sm text-accent-yellow">This squad cannot fill every position for {squadState.formation}.</p>
        )}
      </div>

      <Panel title={`Substitutes (${substitutes.length})`}>
        {substitutes.length === 0 ? <Empty>No substitutes available.</Empty> : substitutes.map(player => (
          <div key={player.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-navy-700/60 text-sm">
            <OvrBadge value={player.overall} />
            <span className="flex-1 truncate"><PlayerLink id={player.id} name={getPlayerName(player)} /></span>
            <PosBadge position={player.position} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
