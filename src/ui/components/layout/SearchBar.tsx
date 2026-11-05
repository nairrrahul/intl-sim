import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../../../store/gameStore";
import { runSearch } from "../../search";
import type { SearchResult } from "../../search";

export function SearchBar() {
  const game = useGame();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const results: SearchResult[] = open ? runSearch(game, query) : [];

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (result: SearchResult) => {
    navigate(result.to);
    setQuery("");
    setOpen(false);
  };

  const kindLabel: Record<SearchResult["kind"], string> = {
    competition: "Competitions", nation: "Nations", player: "Players"
  };

  return (
    <div ref={wrapper} className="relative w-80 max-w-full">
      <input
        className="input w-full"
        placeholder="Search players, nations, competitions…"
        value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (event.key === "Enter" && results[highlight]) choose(results[highlight]);
          else if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && query.trim() !== "" && (
        <div className="absolute left-0 right-0 top-full mt-1 panel shadow-xl max-h-[70vh] overflow-y-auto z-40">
          {results.length === 0 && <div className="px-3 py-3 text-sm text-navy-300">No results.</div>}
          {results.map((result, index) => {
            const showHeader = index === 0 || results[index - 1].kind !== result.kind;
            return (
              <div key={result.key}>
                {showHeader && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-navy-400">
                    {kindLabel[result.kind]}
                  </div>
                )}
                <button
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(result)}
                  className={`w-full text-left px-3 py-1.5 ${index === highlight ? "bg-navy-600" : ""}`}
                >
                  <div className="text-sm">{result.label}</div>
                  <div className="text-xs text-navy-300">{result.sub}</div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
