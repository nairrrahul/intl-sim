import { useState } from "react";
import { Link } from "react-router-dom";
import { useGame, useGameStore } from "../../../store/gameStore";
import { getWindowProgress } from "../../../engine/game";
import { seasonDisplay } from "../../../engine/config";

/**
 * Simulation is window to window; inside a window it can also be stepped matchday to matchday
 * (each matchday plays the next round of every competition in the window).
 */
export function SimControls() {
  const game = useGame();
  const playMatchday = useGameStore(s => s.playMatchday);
  const playWindow = useGameStore(s => s.playWindow);
  const playWindows = useGameStore(s => s.playWindows);
  const finishSeason = useGameStore(s => s.finishSeason);
  const [count, setCount] = useState("3");

  const progress = getWindowProgress(game.world);
  const parsed = /^\d+$/.test(count) ? Number(count) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="text-right mr-1">
        <div className="text-[10px] uppercase tracking-widest text-navy-300">Season {seasonDisplay(game.world.year)}</div>
        <div className="text-sm font-semibold">{progress ? progress.label : "–"}</div>
        {progress && (
          <div className="text-xs text-navy-300 tabular-nums">
            Matchday {Math.min(progress.matchdaysPlayed + 1, progress.matchdayCount)}/{progress.matchdayCount}
          </div>
        )}
      </div>
      <button className="btn-primary" onClick={playMatchday} title="Play the next matchday of the open window">
        Next matchday ▸
      </button>
      <button className="btn-yellow" onClick={playWindow} title="Play the rest of the open window">
        Simulate window ▸
      </button>
      <div className="flex items-center">
        <input
          className="input w-14 rounded-r-none text-center"
          value={count}
          onChange={event => setCount(event.target.value.replace(/[^\d]/g, ""))}
          aria-label="Windows to simulate"
        />
        <button className="btn-ghost rounded-l-none" disabled={parsed < 1} onClick={() => playWindows(parsed)}>
          Play
        </button>
      </div>
      <button className="btn-ghost" onClick={finishSeason} title="Simulate every remaining window of the season">
        Finish season
      </button>
      <Link to="/international" className="btn-ghost">View window</Link>
    </div>
  );
}
