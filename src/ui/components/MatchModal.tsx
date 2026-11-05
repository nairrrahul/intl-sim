import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../../store/gameStore";
import { formatWindowLabel } from "../../engine/international/calendar/windows";
import { getMatchStage } from "../../engine/international/nationViews";
import { getPlayerName } from "../../engine/players/display";
import { getCompetitionNameForKind } from "../competitions";
import type { GoalEvent, InternationalMatch, MatchSide, SubstitutionEvent } from "../../engine/international/types";
import { Modal, NationLink } from "./common";

type TimelineEvent =
  | { type: "substitution"; minute: number; side: MatchSide; substitution: SubstitutionEvent }
  | { type: "goal"; minute: number; side: MatchSide; goal: GoalEvent };

const countScored = (kicks: string[] | undefined): number => (kicks ?? []).filter(kick => kick === "O").length;

/** Goals and the substitutions behind them in minute order (a substitution comes before a goal in the same minute). */
function buildTimeline(match: InternationalMatch): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...(match.substitutions ?? []).map(substitution => ({ type: "substitution" as const, minute: substitution.minute, side: substitution.side, substitution })),
    ...(match.goals ?? []).map(goal => ({ type: "goal" as const, minute: goal.minute, side: goal.side, goal }))
  ];
  return events.sort((a, b) => a.minute - b.minute || (a.type === b.type ? 0 : a.type === "substitution" ? -1 : 1));
}

/** A match report: team names either side, events running down the page by minute. */
export function MatchModal(props: { match: InternationalMatch; onClose: () => void }) {
  const { match } = props;
  const game = useGame();
  const playersById = useMemo(() => new Map(game.world.players.map(player => [player.id, player])), [game.world.players]);

  const playerLink = (id: string) => {
    const player = playersById.get(id);
    return player
      ? <Link to={`/player/${id}`} className="link" onClick={props.onClose}>{getPlayerName(player)}</Link>
      : <span className="text-navy-300">Unknown player</span>;
  };

  const timeline = buildTimeline(match);
  const hasDetails = match.goals !== undefined;
  const homePens = countScored(match.homePenalties);
  const awayPens = countScored(match.awayPenalties);
  const shootout = match.homePenalties && match.awayPenalties;
  const stage = getMatchStage(match);

  const renderEvent = (event: TimelineEvent) => {
    const align = event.side === "home" ? "text-right" : "text-left";
    if (event.type === "goal") {
      return (
        <div className={align}>
          <div className="font-semibold">⚽ {playerLink(event.goal.scorerId)}</div>
          {event.goal.assistId && (
            <div className="text-xs text-navy-300">Assist: {playerLink(event.goal.assistId)}</div>
          )}
        </div>
      );
    }
    return (
      <div className={`${align} text-xs text-navy-300`}>
        <span className="text-green-400">▲</span> {playerLink(event.substitution.onId)}
        <span className="mx-1">for</span>
        <span className="text-red-400">▼</span> {playerLink(event.substitution.offId)}
      </div>
    );
  };

  return (
    <Modal title={getCompetitionNameForKind(match.kind)} onClose={props.onClose} wide>
      <div className="text-center text-xs text-navy-300 mb-4">
        {[stage, match.windowYear !== undefined && match.windowId ? formatWindowLabel(match.windowYear, match.windowId) : null]
          .filter(Boolean).join(" · ")}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-5">
        <div className="text-right text-lg font-semibold"><NationLink code={match.home} /></div>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">{match.homeGoals} – {match.awayGoals}</div>
          {shootout && <div className="text-xs text-navy-300">{homePens} – {awayPens} on penalties</div>}
        </div>
        <div className="text-left text-lg font-semibold"><NationLink code={match.away} /></div>
      </div>

      {!hasDetails ? (
        <p className="text-center text-sm text-navy-300 py-6">Match details are not available for this match.</p>
      ) : (
        <div className="border-t border-navy-700 pt-3">
          {timeline.length === 0 && <p className="text-center text-sm text-navy-300 py-4">No goals.</p>}
          {timeline.map((event, index) => (
            <div key={index} className="grid grid-cols-[1fr_3.5rem_1fr] items-start gap-3 py-1.5">
              <div>{event.side === "home" && renderEvent(event)}</div>
              <div className="text-center">
                <span className="inline-block rounded bg-navy-700 px-2 py-0.5 text-xs font-bold tabular-nums">{event.minute}'</span>
              </div>
              <div>{event.side === "away" && renderEvent(event)}</div>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_3.5rem_1fr] gap-3 pt-2">
            <div />
            <div className="text-center text-[10px] uppercase tracking-widest text-navy-400">Full time</div>
            <div />
          </div>
        </div>
      )}
    </Modal>
  );
}
