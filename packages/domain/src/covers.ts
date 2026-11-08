/** Background tones of a generated cover (DESIGN_SYSTEM.md, "Copertine"), each with its own text colour. */
export const coverTones = ['canopy', 'honey', 'inverse', 'accent'] as const;
export type CoverTone = (typeof coverTones)[number];

/**
 * The tone of the generated cover for a book without an image. Stable: the same title
 * always gets the same tone, on every device and in the future mobile app.
 */
export function coverTone(title: string): CoverTone {
  let hash = 0;
  for (const char of title.normalize('NFC').toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return coverTones[hash % coverTones.length] ?? 'canopy';
}
