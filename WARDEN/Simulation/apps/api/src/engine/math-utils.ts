// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Shared Math Utilities
// Common helpers used across simulation engine modules
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns deterministic midpoint for [lo, hi) */
export function rnd(lo: number, hi: number) {
  return (lo + hi) / 2;
}

/** No noise for deterministic mode */
export function gaussian(_std: number) {
  return 0;
}

/** Linear interpolation from a to b at fraction t */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Add delta to cur with diminishing returns as cur approaches ceil */
export function saturate(cur: number, delta: number, ceil: number) {
  const headroom = Math.max(0, 1 - cur / ceil);
  return Math.min(ceil, cur + delta * headroom);
}

/** Euclidean distance between two 2D points */
export function euclidean(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
