import { asArray, asObject, asStrings, keyId, textValue, without } from './json';
import { roleFromLabel } from './roles';
import { extractYear, formatFromText, invertName, languageCode, positiveInt, text } from './text';
import type { SourceContributor, SourceRecord } from './types';

/** Edition lookup: one request returns the edition with its authors' names. */
export function openLibraryEditionUrl(isbn13: string): string {
  return `https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=ISBN:${isbn13}`;
}

export function openLibraryWorkUrl(workId: string): string {
  return `https://openlibrary.org/works/${encodeURIComponent(workId)}.json`;
}

/** The edition record inside a `jscmd=details` response, or null when the ISBN is unknown. */
export function openLibraryEdition(isbn13: string, response: unknown): Record<string, unknown> | null {
  const details = asObject(asObject(asObject(response)[`ISBN:${isbn13}`]).details);
  return Object.keys(details).length > 0 ? details : null;
}

/** The work key of an edition record, to fetch the description. */
export function openLibraryWorkId(edition: Record<string, unknown>): string | undefined {
  return keyId(asObject(asArray(edition.works)[0]).key);
}

/**
 * Descriptions copied from Wikipedia are CC BY-SA, not open data like the rest of
 * Open Library: they are dropped rather than stored without attribution.
 */
function openDescription(value: unknown): string | undefined {
  const description = textValue(value)?.trim();
  if (!description || /wikipedia/i.test(description)) return undefined;
  return description;
}

function contributors(edition: Record<string, unknown>): SourceContributor[] {
  const found: SourceContributor[] = [];
  for (const item of asArray(edition.contributors)) {
    const entry = asObject(item);
    const role = typeof entry.role === 'string' ? roleFromLabel(entry.role) : undefined;
    const name = text(entry.name);
    if (role && name) found.push({ name: invertName(name), role });
  }
  // `contributions` lists names without roles. A single name with a statement that
  // mentions a translation is the translator; anything less certain is left out.
  const unnamed = asStrings(edition.contributions);
  const statement = typeof edition.by_statement === 'string' ? edition.by_statement : '';
  const only = unnamed.length === 1 ? text(unnamed[0]) : undefined;
  if (found.length === 0 && only && roleFromLabel(statement) === 'translator') {
    found.push({ name: invertName(only), role: 'translator' });
  }
  return found;
}

/** Normalises an Open Library edition and, when fetched, its work. */
export function parseOpenLibrary(edition: Record<string, unknown>, work: unknown): SourceRecord | null {
  const editionId = keyId(edition.key);
  if (!editionId) return null;
  const workRecord = asObject(work);

  const authors = asArray(edition.authors).flatMap((item) => {
    const author = asObject(item);
    const name = text(author.name);
    return name ? [{ name, externalId: keyId(author.key) }] : [];
  });

  const cover = asArray(edition.covers).find((id) => typeof id === 'number' && id > 0);

  return {
    source: 'openlibrary',
    editionId,
    workId: openLibraryWorkId(edition),
    goodreadsIds: asStrings(asObject(edition.identifiers).goodreads),
    title: text(edition.title),
    authors,
    publisher: text(asStrings(edition.publishers)[0]),
    publishedYear: extractYear(text(edition.publish_date)),
    firstPublishedYear: extractYear(text(workRecord.first_publish_date)),
    pageCount: positiveInt(edition.number_of_pages),
    language: languageCode(keyId(asObject(asArray(edition.languages)[0]).key)),
    format: formatFromText(text(edition.physical_format)),
    description: openDescription(edition.description) ?? openDescription(workRecord.description),
    coverId: cover === undefined ? undefined : String(cover),
    contributors: contributors(edition),
    raw: without(edition, []),
    workRaw: Object.keys(workRecord).length > 0 ? without(workRecord, []) : undefined,
  };
}
