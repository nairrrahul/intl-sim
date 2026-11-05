import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useGame } from "../../../store/gameStore";
import { getCompetitionSections } from "../../competitions";
import { LoadGameButton, SaveGameButton } from "../SaveLoad";

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 px-4 py-1.5 text-sm border-l-4 transition-colors ${
    isActive
      ? "bg-navy-700 border-accent-yellow text-white font-semibold"
      : "border-transparent text-navy-200 hover:bg-navy-800 hover:text-white"
  }`;
}

/** One of the sidebar's top-level groups. */
function NavGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-navy-400">{props.title}</div>
      {props.children}
    </div>
  );
}

/** A parent competition and its pages, visually set apart from its neighbours. */
function CompetitionBlock(props: { title: string; children: ReactNode }) {
  return (
    <div className="mx-2 mt-2 rounded-md border border-navy-700 bg-navy-950/40 py-1">
      <div className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-yellow">{props.title}</div>
      {props.children}
    </div>
  );
}

export function Sidebar() {
  const game = useGame();
  const competitionSections = getCompetitionSections();

  return (
    <aside className="w-56 shrink-0 bg-navy-900 border-r border-navy-700 flex flex-col overflow-y-auto">
      <div className="px-4 py-4 border-b border-navy-700">
        <div className="text-[10px] uppercase tracking-widest text-accent-yellow font-bold">Observer Mode</div>
        <div className="font-bold leading-tight mt-0.5">International Football</div>
      </div>
      <nav className="py-2 flex-1">
        <NavLink to="/" end className={navClass}>Home</NavLink>

        <NavGroup title="Players">
          <NavLink to="/player-search" className={navClass}>Player Search</NavLink>
          <NavLink to="/shortlist" className={navClass}>Shortlist</NavLink>
        </NavGroup>

        <NavGroup title="International Competitions">
          <NavLink to="/international" className={navClass}>International Windows</NavLink>
          <NavLink to="/rankings" className={navClass}>World Rankings</NavLink>
          {competitionSections.map(section => (
            <CompetitionBlock key={section.id} title={section.title}>
              {section.links.map(link => (
                <NavLink key={link.to} to={link.to} className={navClass}>{link.label}</NavLink>
              ))}
            </CompetitionBlock>
          ))}
        </NavGroup>

        {game.world.godMode && (
          <NavGroup title="God Mode">
            <NavLink to="/god/add-player" className={navClass}>Add Player</NavLink>
          </NavGroup>
        )}
      </nav>
      <div className="p-3 border-t border-navy-700 grid grid-cols-2 gap-2">
        <SaveGameButton className="btn-ghost btn-sm" />
        <LoadGameButton className="btn-ghost btn-sm" confirmReplace />
      </div>
    </aside>
  );
}
