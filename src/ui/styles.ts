/**
 * Shared styling constants. Row highlights mean the same thing on every competition page:
 *   GREEN  - qualifies / promoted / advances
 *   YELLOW - possible qualification (best-placed third places, play-offs)
 *   RED    - relegated / eliminated
 */
export const ROW_HIGHLIGHT = {
  GREEN: "bg-green-500/15",
  YELLOW: "bg-yellow-400/15",
  RED: "bg-red-500/15"
} as const;

export type RowHighlight = typeof ROW_HIGHLIGHT[keyof typeof ROW_HIGHLIGHT];

/** Highlight classes by 1-based table position. */
export type RowHighlights = Record<number, RowHighlight>;
