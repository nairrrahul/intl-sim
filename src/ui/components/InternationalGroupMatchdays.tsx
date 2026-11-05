import type { InternationalMatch } from "../../engine/international/types";
import { NationLink } from "./common";
import { useMatchInteractions } from "./matchInteractions";

function Fixture(props: { match: InternationalMatch }) {
  const { home, away, homeGoals, awayGoals } = props.match;
  const played = homeGoals !== null && awayGoals !== null;
  const interactions = useMatchInteractions();
  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-navy-700/60 px-3 py-2 text-sm ${interactions.matchClass(props.match)}`}
      {...interactions.matchProps(props.match)}
    >
      <div className="flex justify-end"><NationLink code={home} /></div>
      <div className="min-w-16 rounded bg-navy-900 px-2 py-0.5 text-center font-bold tabular-nums">
        {played ? `${homeGoals}-${awayGoals}` : "–"}
      </div>
      <div className="flex items-center gap-2"><NationLink code={away} /></div>
    </div>
  );
}

export function InternationalGroupMatchdays(props: { rounds: InternationalMatch[][] }) {
  return (
    <div className="border-t border-navy-700">
      <details className="group/matchdays">
        <summary className="list-none cursor-pointer px-3 py-3 text-sm font-bold uppercase tracking-wider text-navy-200 hover:text-white">
          <span className="inline-flex items-center gap-2">
            <span className="text-[10px] transition-transform group-open/matchdays:rotate-90">▶</span>
            Matchdays
          </span>
        </summary>
        <div className="border-t border-navy-700/60">
          {props.rounds.map((round, roundIndex) => (
            <details key={roundIndex} className="group/matchday border-b border-navy-700/60 last:border-b-0">
              <summary className="list-none cursor-pointer px-3 py-3 text-xs font-semibold uppercase tracking-wider text-navy-400 hover:text-white">
                <span className="inline-flex items-center gap-2">
                  <span className="text-[10px] transition-transform group-open/matchday:rotate-90">▶</span>
                  Matchday {roundIndex + 1}
                </span>
              </summary>
              {round.map((match, index) => <Fixture key={index} match={match} />)}
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}
