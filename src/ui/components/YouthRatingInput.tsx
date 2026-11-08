import { useState } from "react";
import { useGame, useGameStore } from "../../store/gameStore";

/** A nation's youth rating: plain text normally, an editable box in God Mode (saved on Enter or blur). */
export function YouthRatingInput(props: { code: string; className?: string }) {
  const game = useGame();
  const setRating = useGameStore(s => s.godSetYouthRating);
  const nation = game.world.international.nations[props.code];
  const [draft, setDraft] = useState<string | null>(null);

  const rating = (
    <span className={props.className}>
      {nation.youthRating}
      {nation.goldenGeneration && (
        <span className="ml-1 text-accent-yellow" title={`Golden generation: ${nation.goldenGeneration.yearsLeft} years remaining`}>
          ☀
        </span>
      )}
    </span>
  );
  if (!game.world.godMode) return rating;

  const commit = () => {
    if (draft !== null && draft !== "") setRating(props.code, Number(draft));
    setDraft(null);
  };
  return (
    <span className="inline-flex items-center">
      <input
        className={`input w-20 text-center ${props.className ?? ""}`}
        inputMode="numeric"
        value={draft ?? String(nation.youthRating)}
        onChange={event => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={event => { if (event.key === "Enter") commit(); }}
        aria-label={`${props.code} youth rating`}
      />
      {nation.goldenGeneration && (
        <span className="ml-1 text-accent-yellow" title={`Golden generation: ${nation.goldenGeneration.yearsLeft} years remaining`}>
          ☀
        </span>
      )}
    </span>
  );
}
