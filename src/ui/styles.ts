/**
 * Shared styling constants. Row highlights mean the same thing on every competition page:
 *   GREEN  - qualifies / promoted / advances
 *   YELLOW - possible qualification (best-placed third places, play-offs)
 *   RED    - relegated / eliminated
 */
export const ROW_HIGHLIGHT = {
  GREEN: "bg-green-500/10",
  YELLOW: "bg-yellow-400/10",
  RED: "bg-red-500/10"
} as const;

export type RowHighlight = typeof ROW_HIGHLIGHT[keyof typeof ROW_HIGHLIGHT];

/** Highlight classes by 1-based table position. */
export type RowHighlights = Record<number, RowHighlight>;
