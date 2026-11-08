import { cleanText } from '@libresca/domain';

import { asArray, asObject, asStrings, without } from './json';
import { roleFromLabel } from './roles';
import { extractYear, invertName, languageCode, text } from './text';
import type { SourceContributor, SourceRecord } from './types';

// OPAC SBN mobile gateway: undocumented but used by SBN's own app (ADR-0008). CC0 data.
const base = 'https://opac.sbn.it/opacmobilegw';

/** Only Italian registration groups are worth asking SBN about. */
export function isItalianIsbn(isbn13: string): boolean {
  return isbn13.startsWith('97888') || isbn13.startsWith('97912');
}

export function sbnSearchUrl(isbn13: string): string {
  return `${base}/search.json?isbn=${isbn13}`;
}

export function sbnFullUrl(bid: string): string {
  return `${base}/full.json?bid=${encodeURIComponent(bid)}`;
}

/** The BID of the first printed text in a search response. */
export function sbnBidFromSearch(response: unknown): string | null {
  const record = asArray(asObject(response).briefRecords)
    .map(asObject)
    .find((brief) => typeof brief.tipo === 'string' && brief.tipo.toLowerCase().startsWith('testo'));
  return text(record?.codiceIdentificativo) ?? null;
}

/**
 * "Se questo è un uomo / Primo Levi ; postfazione di Cesare Segre": the title before
 * " / " (without the subtitle after " : "), and the statement of responsibility after it.
 */
function splitTitle(value: string): { title?: string; responsibility: string } {
  const slash = value.indexOf(' / ');
  const full = slash < 0 ? value : value.slice(0, slash);
  const responsibility = slash < 0 ? '' : value.slice(slash + 3);
  const colon = full.indexOf(' : ');
  return { title: text(colon < 0 ? full : full.slice(0, colon)), responsibility };
}

/** "edizione italiana a cura di Quirino Principe" gives an editor named Quirino Principe. */
function contributorsFrom(responsibility: string): SourceContributor[] {
  const found: SourceContributor[] = [];
  for (const segment of responsibility.split(' ; ')) {
    const at = segment.lastIndexOf(' di ');
    if (at < 0) continue;
    const role = roleFromLabel(segment.slice(0, at));
    if (!role) continue;
    for (const name of segment.slice(at + 4).split(/\s*,\s*|\s+e\s+/)) {
      const clean = cleanText(name.replace(/[.\]]+$/, ''));
      if (clean) found.push({ name: clean, role });
    }
  }
  return found;
}

/** "Torino : Einaudi, 2015" gives "Einaudi"; also "[2014]" and "c2019". */
function publisherFrom(publication: string): string | undefined {
  const first = publication.split(' ; ')[0] ?? '';
  const colon = first.indexOf(' : ');
  const rest = colon < 0 ? first : first.slice(colon + 3);
  return text(rest.replace(/,?\s*\[?c?\.?\s*\d{4}\]?.*$/, ''));
}

/** Normalises an SBN full record. */
export function parseSbn(response: unknown): SourceRecord | null {
  const record = asObject(response);
  const bid = text(record.codiceIdentificativo);
  if (!bid) return null;

  const { title, responsibility } = splitTitle(typeof record.titolo === 'string' ? record.titolo : '');
  const headings = asStrings(record.nomi)
    .filter((name) => name.startsWith('[Autore]'))
    .map(invertName);
  const main = typeof record.autorePrincipale === 'string' ? invertName(record.autorePrincipale) : '';
  const authors = (headings.length > 0 ? headings : [main]).filter(Boolean).map((name) => ({ name }));
  const pages = /(\d+)\s*p\b/.exec(typeof record.descrizioneFisica === 'string' ? record.descrizioneFisica : '');
  const publication = typeof record.pubblicazione === 'string' ? record.pubblicazione : '';

  return {
    source: 'sbn',
    editionId: bid,
    goodreadsIds: [],
    title,
    authors,
    publisher: publisherFrom(publication),
    publishedYear: extractYear(publication),
    pageCount: pages ? Number(pages[1]) : undefined,
    language: languageCode(text(record.linguaPubblicazione)),
    contributors: contributorsFrom(responsibility),
    // `copertina` embeds SBN's LibraryThing developer key: never stored. Holdings and
    // citations are bulky and add nothing to the catalog.
    raw: without(record, ['copertina', 'localizzazioni', 'citazioni']),
  };
}
