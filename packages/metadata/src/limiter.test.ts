import { describe, expect, it } from 'vitest';

import { createWindowLimiter } from './limiter';

describe('createWindowLimiter', () => {
  it('allows up to the limit per key and window', () => {
    let clock = 0;
    const limiter = createWindowLimiter(2, 1000, () => clock);
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([true, true, false]);
    expect(limiter.take('b')).toBe(true);
    clock = 1000;
    expect(limiter.take('a')).toBe(true);
  });
});
