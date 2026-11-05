/** Player IDs are sequential and unique within a world, e.g. "P000042". */
export function formatPlayerId(sequence: number): string {
  return `P${String(sequence).padStart(6, "0")}`;
}
