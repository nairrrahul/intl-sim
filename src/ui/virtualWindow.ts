/** Which rows of a long, fixed-row-height list should be in the DOM for a scroll position. */
export interface VirtualWindow {
  /** False for short lists, which render every row. */
  virtualized: boolean;
  firstRow: number;
  visibleCount: number;
}

export function computeVirtualWindow(options: {
  rowCount: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
  virtualizeAfter: number;
}): VirtualWindow {
  const { rowCount, rowHeight, scrollTop, viewportHeight, overscan, virtualizeAfter } = options;
  if (rowCount <= virtualizeAfter) return { virtualized: false, firstRow: 0, visibleCount: rowCount };

  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  // Never start so late that the window runs past the end of the list (e.g. after a filter shrinks it).
  const lastStart = Math.max(0, rowCount - visibleCount);
  const firstRow = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan), lastStart);
  return { virtualized: true, firstRow, visibleCount };
}
