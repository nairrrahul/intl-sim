import { useEffect, useState } from "react";

interface Tooltip {
  text: string;
  x: number;
  y: number;
}

const OFFSET_X = 14;
const OFFSET_Y = 18;
const MAX_WIDTH = 288;

/**
 * One styled tooltip for the whole app. Any element with a `data-tooltip` attribute shows it on hover
 * (it works on table rows and SVG icons, which a wrapper component cannot).
 */
export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    const show = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.("[data-tooltip]") as HTMLElement | null;
      const text = target?.dataset.tooltip;
      setTooltip(text ? { text, x: event.clientX, y: event.clientY } : null);
    };
    const hide = () => setTooltip(null);
    document.addEventListener("mousemove", show);
    document.addEventListener("mousedown", hide);
    document.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mousemove", show);
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tooltip) return null;
  const left = Math.min(tooltip.x + OFFSET_X, window.innerWidth - MAX_WIDTH - 8);
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[70] rounded-md border border-navy-500 bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl"
      style={{ left, top: tooltip.y + OFFSET_Y, maxWidth: MAX_WIDTH }}
    >
      {tooltip.text}
    </div>
  );
}
