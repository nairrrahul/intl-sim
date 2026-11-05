import { useGameStore } from "../../store/gameStore";
import { LoadGameButton } from "../components/SaveLoad";

export default function Start() {
  const startGame = useGameStore(s => s.startGame);

  return (
    <div className="min-h-full bg-navy-950">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-accent-yellow">International Soccer Simulator</div>
            <LoadGameButton className="btn-ghost" label="Load saved game" />
          </div>
          <h1 className="text-4xl font-bold mt-1">Watch the world game unfold</h1>
          <p className="text-navy-200 mt-2 max-w-2xl">
            Every national team, every international competition. Simulate one window at a time, or step through each
            window matchday by matchday.
          </p>
        </div>

        <div className="panel p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">New simulation</h2>
            <p className="text-sm text-navy-300">
              Starts in the 2026-27 season with the players from players.json.
            </p>
          </div>
          <button className="btn-yellow shrink-0" onClick={startGame}>Start simulation ▸</button>
        </div>
      </div>
    </div>
  );
}
