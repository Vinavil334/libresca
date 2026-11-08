/**
 * Fixed-window counter per key, in memory. It protects the shared Google Books quota
 * from a single runaway client; each serverless instance counts on its own.
 */
export interface WindowLimiter {
  /** True when the key may make one more request now, and counts it. */
  take(key: string): boolean;
}

export function createWindowLimiter(limit: number, windowMs: number, now: () => number = Date.now): WindowLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    take(key) {
      const current = now();
      const window = windows.get(key);
      if (!window || current - window.start >= windowMs) {
        windows.set(key, { start: current, count: 1 });
        // Drop expired windows now and then, so the map does not grow forever.
        if (windows.size > 1000) {
          for (const [k, w] of windows) if (current - w.start >= windowMs) windows.delete(k);
        }
        return true;
      }
      if (window.count >= limit) return false;
      window.count += 1;
      return true;
    },
  };
}
