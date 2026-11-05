import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useGame, useGameStore } from "../../../store/gameStore";

export function Toasts() {
  useGame();
  const toasts = useGameStore(s => s.toasts);
  const dismiss = useGameStore(s => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map(toast => setTimeout(() => dismiss(toast.id), toast.kind === "error" ? 7000 : 5000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-96 max-w-[90vw]">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`rounded-lg px-4 py-3 text-sm shadow-xl cursor-pointer border ${
            toast.kind === "error" ? "bg-navy-800 border-accent-yellow text-white"
            : toast.kind === "info" ? "bg-accent-purple border-accent-purple-light text-white"
            : "bg-navy-700 border-navy-500 text-white"
          }`}
        >
          {toast.kind === "error" && <span className="text-accent-yellow font-bold mr-1.5">!</span>}
          {toast.text}
          {toast.link && (
            <Link
              to={toast.link.to}
              onClick={event => event.stopPropagation()}
              className="link ml-2 font-semibold"
            >
              {toast.link.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
