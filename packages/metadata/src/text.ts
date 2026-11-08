import { type EditionFormat, cleanText } from '@libresca/domain';

/** Lowercase, without accents or punctuation: for comparing names, never for display. */
export function matchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The last word of a name, for matching the same person across sources. */
export function surnameKey(name: string): string {
  const words = matchKey(name).split(' ');
  return words[words.length - 1] ?? '';
}

/**
 * Turns a catalogue heading into a display name: "Levi, Primo <1919-1987>" becomes
 * "Primo Levi", "McDuff, David, 1945-" becomes "David McDuff".
 */
export function invertName(heading: string): string {
  const clean = cleanText(
    heading
      .replace(/<[^>]*>/g, ' ')
      .replace(/,?\s*\d{4}-(\d{4})?\.?\s*$/, '')
      .replace(/^\[[^\]]*\]/, ''),
  ).replace(/,$/, '');
  const comma = clean.indexOf(', ');
  if (comma < 0) return clean;
  return cleanText(`${clean.slice(comma + 2)} ${clean.slice(0, comma)}`);
}

/** The first plausible publication year in a free-text date: "Milano : Bompiani, [2014]" gives 2014, "c2021" gives 2021. */
export function extractYear(text: string | undefined | null): number | undefined {
  const match = /(?<!\d)(1[4-9]\d{2}|20\d{2})(?!\d)/.exec(text ?? '');
  return match ? Number(match[1]) : undefined;
}

/** A positive integer, or undefined. */
export function positiveInt(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof number === 'number' && Number.isInteger(number) && number > 0 ? number : undefined;
}

/** Text that is non-empty after cleaning, or undefined. */
export function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = cleanText(value);
  return clean || undefined;
}

// MARC language codes (Open Library) and Italian names (SBN) to ISO 639-1.
const iso639: Record<string, string> = {
  ita: 'it',
  italiano: 'it',
  eng: 'en',
  inglese: 'en',
  fre: 'fr',
  fra: 'fr',
  francese: 'fr',
  ger: 'de',
  deu: 'de',
  tedesco: 'de',
  spa: 'es',
  spagnolo: 'es',
  por: 'pt',
  portoghese: 'pt',
  rus: 'ru',
  russo: 'ru',
  jpn: 'ja',
  giapponese: 'ja',
  chi: 'zh',
  zho: 'zh',
  cinese: 'zh',
  dut: 'nl',
  nld: 'nl',
  olandese: 'nl',
  swe: 'sv',
  svedese: 'sv',
  lat: 'la',
  latino: 'la',
  gre: 'el',
  ell: 'el',
  greco: 'el',
  pol: 'pl',
  polacco: 'pl',
};

/** ISO 639-1 when known; otherwise a three-letter code as given; otherwise undefined. */
export function languageCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  if (iso639[key]) return iso639[key];
  return /^[a-z]{2,3}$/.test(key) ? key : undefined;
}

/** Open Library `physical_format` is free text: "Paperback", "Mass Market Paperback", "Hardcover"… */
export function formatFromText(value: string | undefined): EditionFormat | undefined {
  const key = matchKey(value ?? '');
  if (!key) return undefined;
  if (/\b(hardcover|hardback|rilegato|cartonato)\b/.test(key)) return 'hardcover';
  if (/\b(paperback|softcover|brossura|tascabile)\b/.test(key)) return 'paperback';
  if (/\b(ebook|e book|kindle|epub)\b/.test(key)) return 'ebook';
  if (/\b(audio|audiobook|audiolibro|cd)\b/.test(key)) return 'audiobook';
  return undefined;
}
