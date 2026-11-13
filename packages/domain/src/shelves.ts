/**
 * Shelves (F1.7c): names the owner chooses, such as "Comodino". The database repeats
 * these rules: a trimmed name of 1 to 60 characters, unique per account ignoring case.
 */

export const shelfNameMaxLength = 60;

export type ShelfNameIssue = 'required' | 'too_long';

export type ShelfNameValidation = { ok: true; name: string } | { ok: false; issue: ShelfNameIssue };

/** Trims the name and collapses inner runs of spaces: "  Da  regalare " becomes "Da regalare". */
export function validateShelfName(input: string): ShelfNameValidation {
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name === '') return { ok: false, issue: 'required' };
  if ([...name].length > shelfNameMaxLength) return { ok: false, issue: 'too_long' };
  return { ok: true, name };
}
