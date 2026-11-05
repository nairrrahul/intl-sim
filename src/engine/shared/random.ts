/** Random helpers shared across the engine. All randomness flows through Math.random. */

export function shuffleInPlace<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

export function shuffledCopy<T>(values: readonly T[]): T[] {
  return shuffleInPlace([...values]);
}

export function randomSortCopy<T>(values: readonly T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5);
}

/** Uniform integer in [min, max] (inclusive). */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Standard normal sample (Box-Muller). */
export function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Picks a value with probability proportional to its weight; null when all weights are zero. */
export function weightedPick<T>(entries: [T, number][]): T | null {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;

  let random = Math.random() * total;
  for (const [value, weight] of entries) {
    if (random < weight) return value;
    random -= weight;
  }
  return entries.at(-1)?.[0] ?? null;
}

export function pickRandom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

/** Normal sample with the given mean and standard deviation. */
export function gauss(mean = 0, std = 1): number {
  return gaussian() * std + mean;
}

export function uniform(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Normal sample redrawn until it falls in [low, high]; clamps the mean if no draw fits. */
export function truncatedNormal(mean: number, sd: number, low: number, high: number): number {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const value = gauss(mean, sd);
    if (value >= low && value <= high) return value;
  }
  return Math.max(low, Math.min(mean, high));
}
