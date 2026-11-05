import { useEffect, useRef, useState } from "react";
import { useGame, useGameStore } from "../../../store/gameStore";

/** Header gear menu: currently just the God Mode switch. */
export function SettingsMenu() {
  const game = useGame();
  const setGodMode = useGameStore(s => s.setGodMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost" onClick={() => setOpen(!open)} aria-label="Settings" aria-expanded={open}>
        ⚙{game.world.godMode && <span className="ml-1.5 text-xs font-bold text-accent-yellow">God Mode</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 z-40 rounded-md border border-navy-600 bg-navy-800 p-3 shadow-xl text-sm">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={game.world.godMode}
              onChange={event => setGodMode(event.target.checked)}
            />
            <span>
              <span className="font-semibold">God Mode</span>
              <span className="block text-xs text-navy-300">
                Edit youth ratings, add players, change formations, and right-click fixtures to rig them.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
