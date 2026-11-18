import { useGameStore } from "../../store/gameStore";
import { LoadGameButton } from "../components/SaveLoad";

export default function Start() {
  const startGame = useGameStore(s => s.startGame);

  return (
    <div className="min-h-full bg-navy-950">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-accent-yellow">FA.SIM</div>
            <LoadGameButton className="btn-ghost" label="Load saved game" />
          </div>
          <h1 className="text-4xl font-bold mt-1">International Soccer Simulator</h1>
          <p className="text-navy-200 mt-2 max-w-2xl">
            Simulate every national team competition, one year at a time. Build your own future.
          </p>
        </div>

        <div className="panel p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">New Simulation</h2>
            <p className="text-sm text-navy-300">
              Starts in the 2026-27 season
            </p>
          </div>
          <button className="btn-yellow shrink-0" onClick={startGame}>Start simulation ▸</button>
        </div>
      </div>
    </div>
  );
}
