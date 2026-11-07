import { createContext, useContext, useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useGameStore } from "../../store/gameStore";
import { getNationName } from "../../engine/nations/nations";
import type { InternationalMatch } from "../../engine/international/types";
import { Modal } from "./common";
import { MatchModal } from "./MatchModal";

/** Red outline marking a rigged match (an outline, not a fill, so it never reads as a highlight). */
const RIGGED_CLASS = "outline outline-2 -outline-offset-2 outline-red-500 rounded-sm";

const isPlayed = (match: InternationalMatch): boolean => match.homeGoals !== null && match.awayGoals !== null;

/** One fixture, or every leg of a two-legged tie. */
type MatchTarget = InternationalMatch | InternationalMatch[] | undefined;

const toList = (target: MatchTarget): InternationalMatch[] =>
  Array.isArray(target) ? target : target ? [target] : [];

/** Hover feedback for a fixture that can be opened: clearly visible, and distinct from the red rigged outline. */
const CLICKABLE_CLASS = "cursor-pointer transition-colors hover:!bg-accent-purple/25";

interface MatchInteractionApi {
  /** Extra class names for a fixture element: the red outline when rigged, hover feedback when it can be opened. */
  matchClass: (target: MatchTarget) => string;
  /**
   * Props to spread on a fixture element: clicking a played match (or tie) opens its details, and in
   * God Mode right-clicking an unplayed match opens the rigging menu.
   */
  matchProps: (target: MatchTarget) => {
    onClick?: (event: MouseEvent) => void;
    onContextMenu?: (event: MouseEvent) => void;
    "data-tooltip"?: string;
  };
}

const MatchInteractionContext = createContext<MatchInteractionApi>({ matchClass: () => "", matchProps: () => ({}) });

export const useMatchInteractions = (): MatchInteractionApi => useContext(MatchInteractionContext);

interface MenuState {
  match: InternationalMatch;
  x: number;
  y: number;
}

function RigDialog(props: { match: InternationalMatch; onClose: () => void }) {
  const { match } = props;
  const rig = useGameStore(s => s.godRigMatch);
  const [home, setHome] = useState(String(match.rigged?.homeGoals ?? 1));
  const [away, setAway] = useState(String(match.rigged?.awayGoals ?? 0));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const result = rig(match, Number(home), Number(away));
    if (result.ok) props.onClose();
    else setError(result.error ?? "Unable to rig this match.");
  };

  return (
    <Modal title="Rig match" onClose={props.onClose}>
      <div className="text-sm text-navy-100 space-y-4">
        <p>Choose the result this match will have when it is played. A drawn knockout match goes to a randomized penalty shootout.</p>
        <div className="grid grid-cols-[1fr_5rem_5rem_1fr] items-center gap-3">
          <span className="text-right font-semibold truncate">{getNationName(match.home)}</span>
          <input className="input text-center" inputMode="numeric" value={home} onChange={event => { setHome(event.target.value.replace(/\D/g, "")); setError(null); }} aria-label="Home goals" />
          <input className="input text-center" inputMode="numeric" value={away} onChange={event => { setAway(event.target.value.replace(/\D/g, "")); setError(null); }} aria-label="Away goals" />
          <span className="font-semibold truncate">{getNationName(match.away)}</span>
        </div>
        {error && <p role="alert" className="text-accent-yellow">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={props.onClose}>Cancel</button>
        <button className="btn-yellow" disabled={home === "" || away === ""} onClick={save}>Rig match</button>
      </div>
    </Modal>
  );
}

/** Provides match details (click) and God Mode rigging (right-click) to every fixture rendered beneath it. */
export function MatchInteractionsProvider(props: { godMode: boolean; children: ReactNode }) {
  const clearRig = useGameStore(s => s.godClearRig);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dialogMatch, setDialogMatch] = useState<InternationalMatch | null>(null);
  const [detailsMatches, setDetailsMatches] = useState<InternationalMatch[]>([]);
  const location = useLocation();

  // Moving to another page (by any link, e.g. a nation or a player in the report) dismisses open dialogs.
  useEffect(() => {
    setDetailsMatches([]);
    setDialogMatch(null);
    setMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const api: MatchInteractionApi = {
    matchClass: target => {
      const matches = toList(target);
      const classes = [
        matches.some(match => match.rigged) ? RIGGED_CLASS : "",
        matches.some(isPlayed) ? CLICKABLE_CLASS : ""
      ];
      return classes.filter(Boolean).join(" ");
    },
    matchProps: target => {
      const matches = toList(target);
      const played = matches.filter(isPlayed);
      if (played.length > 0) {
        return {
          // Links inside a fixture (nations, players) keep their own behaviour.
          onClick: event => {
            if (!(event.target as HTMLElement).closest("a")) setDetailsMatches(played);
          },
          "data-tooltip": "Click for match details"
        };
      }
      const unplayed = matches[0];
      if (!props.godMode || !unplayed) return {};
      return {
        onContextMenu: event => {
          event.preventDefault();
          setMenu({ match: unplayed, x: event.clientX, y: event.clientY });
        },
        "data-tooltip": unplayed.rigged
          ? `Rigged ${unplayed.rigged.homeGoals}-${unplayed.rigged.awayGoals} (right-click to change)`
          : "Right-click to rig this match"
      };
    }
  };

  return (
    <MatchInteractionContext.Provider value={api}>
      {props.children}
      {menu && (
        <div
          className="fixed z-50 min-w-40 rounded-md border border-navy-600 bg-navy-800 py-1 shadow-xl text-sm"
          style={{ left: menu.x, top: menu.y }}
        >
          <button className="block w-full px-3 py-1.5 text-left hover:bg-navy-700" onClick={() => { setDialogMatch(menu.match); setMenu(null); }}>
            Rig match…
          </button>
          {menu.match.rigged && (
            <button className="block w-full px-3 py-1.5 text-left hover:bg-navy-700" onClick={() => { clearRig(menu.match); setMenu(null); }}>
              Clear rig
            </button>
          )}
        </div>
      )}
      {dialogMatch && <RigDialog match={dialogMatch} onClose={() => setDialogMatch(null)} />}
      {detailsMatches.length > 0 && <MatchModal matches={detailsMatches} onClose={() => setDetailsMatches([])} />}
    </MatchInteractionContext.Provider>
  );
}
