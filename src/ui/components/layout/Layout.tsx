import type { ReactNode } from "react";
import { useGame, useGameStore } from "../../../store/gameStore";
import { SearchBar } from "./SearchBar";
import { Sidebar } from "./Sidebar";
import { SettingsMenu } from "./SettingsMenu";
import { SimControls } from "./SimControls";
import { Toasts } from "./Toasts";
import { TooltipLayer } from "./TooltipLayer";
import { MatchInteractionsProvider } from "../matchInteractions";

export function Layout(props: { children: ReactNode }) {
  const game = useGame();
  const gameId = useGameStore(s => s.gameId);
  return (
    <MatchInteractionsProvider godMode={game.world.godMode}>
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-navy-900 border-b border-navy-700">
          <SearchBar />
          <div className="flex items-center gap-2">
            <SimControls />
            <SettingsMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6" key={`${gameId}-${game.world.year}`}>
          {props.children}
        </main>
      </div>
      <Toasts />
      <TooltipLayer />
    </div>
    </MatchInteractionsProvider>
  );
}
