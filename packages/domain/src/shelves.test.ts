import { describe, expect, it } from 'vitest';

import { shelfNameMaxLength, validateShelfName } from './shelves';

describe('validateShelfName', () => {
  it('tidies spaces and keeps the name as written', () => {
    expect(validateShelfName('  Da   regalare ')).toEqual({ ok: true, name: 'Da regalare' });
    expect(validateShelfName('Comodino')).toEqual({ ok: true, name: 'Comodino' });
  });

  it('refuses an empty or too long name', () => {
    expect(validateShelfName('   ')).toEqual({ ok: false, issue: 'required' });
    expect(validateShelfName('a'.repeat(shelfNameMaxLength + 1))).toEqual({ ok: false, issue: 'too_long' });
    expect(validateShelfName('è'.repeat(shelfNameMaxLength))).toMatchObject({ ok: true });
  });
});
