/**
 * Shared catalog rules (ADR-0002, ADR-0008): what a new catalog entry may contain,
 * how it is normalised, and the payload that `public.create_edition` expects.
 *
 * The database repeats the essential checks as constraints; this module catches
 * mistakes earlier and reports them as codes the UI can translate.
 */
import { toIsbn13 } from './isbn';

export const metadataSources = ['openlibrary', 'googlebooks', 'sbn', 'goodreads', 'user'] as const;
export type MetadataSource = (typeof metadataSources)[number];

/** Sources with their own identifiers: every metadata source except the user. */
export const externalIdSources = ['openlibrary', 'googlebooks', 'sbn', 'goodreads'] as const;
export type ExternalIdSource = (typeof externalIdSources)[number];

export const coverSources = ['openlibrary', 'googlebooks', 'upload', 'generated'] as const;
export type CoverSource = (typeof coverSources)[number];

export const metadataStatuses = ['incomplete', 'complete'] as const;
export type MetadataStatus = (typeof metadataStatuses)[number];

export const editionFormats = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other'] as const;
export type EditionFormat = (typeof editionFormats)[number];

export const contributorRoles = ['translator', 'editor', 'illustrator', 'introduction', 'other'] as const;
export type ContributorRole = (typeof contributorRoles)[number];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Which source each field's value came from, for example `{ title: 'sbn' }`. */
export type FieldSources = Record<string, MetadataSource>;

export interface ExternalIdInput {
  source: ExternalIdSource;
  value: string;
  /** Raw payload, kept for provenance. Always dropped for Google Books (ADR-0008). */
  raw?: JsonValue;
}

export type AuthorInput =
  { id: string } | { name: string; sortName?: string; alternateNames?: string[]; externalIds?: ExternalIdInput[] };

export type WorkInput =
  | { id: string }
  | {
      title: string;
      originalTitle?: string;
      originalLanguage?: string;
      firstPublishedYear?: number;
      description?: string;
      fieldSources?: FieldSources;
      externalIds?: ExternalIdInput[];
      authors: AuthorInput[];
    };

export interface ContributorInput {
  name: string;
  role: ContributorRole;
}

export interface EditionInput {
  /** Defaults to the work title. */
  title?: string;
  /** Any ISBN-10 or ISBN-13 form: it is stored as ISBN-13. */
  isbn?: string;
  language?: string;
  publisher?: string;
  publishedYear?: number;
  format?: EditionFormat;
  pageCount?: number;
  coverSource?: CoverSource;
  coverId?: string;
  coverPath?: string;
  metadataStatus?: MetadataStatus;
  fieldSources?: FieldSources;
  contributors?: ContributorInput[];
  externalIds?: ExternalIdInput[];
}

export interface CatalogEntryInput {
  work: WorkInput;
  edition: EditionInput;
}

export type CatalogIssueCode =
  | 'required'
  | 'too_long'
  | 'invalid_id'
  | 'duplicate'
  | 'invalid_isbn'
  | 'invalid_language'
  | 'invalid_year'
  | 'invalid_page_count'
  | 'invalid_option'
  | 'missing_cover_reference'
  | 'googlebooks_not_storable';

export interface CatalogIssue {
  /** Dotted path of the field, for example `work.authors.1.name`. */
  path: string;
  code: CatalogIssueCode;
}

/** The JSON body of `public.create_edition`, in the database's column names. */
export interface CatalogEntryPayload {
  work: { id: string } | NewWorkPayload;
  edition: EditionPayload;
}

interface ExternalIdPayload {
  source: ExternalIdSource;
  value: string;
  raw?: JsonValue;
}

type AuthorPayload =
  { id: string } | { name: string; sort_name: string; alternate_names: string[]; external_ids: ExternalIdPayload[] };

interface NewWorkPayload {
  title: string;
  original_title?: string;
  original_language?: string;
  first_published_year?: number;
  description?: string;
  field_sources: FieldSources;
  external_ids: ExternalIdPayload[];
  authors: AuthorPayload[];
}

interface EditionPayload {
  title?: string;
  isbn13?: string;
  language?: string;
  publisher?: string;
  published_year?: number;
  format?: EditionFormat;
  page_count?: number;
  cover_source?: CoverSource;
  cover_id?: string;
  cover_path?: string;
  metadata_status?: MetadataStatus;
  field_sources: FieldSources;
  contributors: ContributorInput[];
  external_ids: ExternalIdPayload[];
}

export type CatalogValidation = { ok: true; entry: CatalogEntryPayload } | { ok: false; issues: CatalogIssue[] };

// Limits mirror the constraints in supabase/migrations/*_catalog.sql.
const limits = {
  title: 500,
  description: 10000,
  name: 200,
  publisher: 200,
  externalId: 200,
  coverId: 100,
  coverPath: 500,
} as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const languagePattern = /^[a-z]{2,3}$/;

/**
 * Particles that belong to the surname when sorting: "Erri De Luca" sorts as
 * "De Luca, Erri", "Vincent van Gogh" as "van Gogh, Vincent".
 */
const surnameParticles = new Set([
  'da',
  'dal',
  'dalla',
  'de',
  'degli',
  'dei',
  'del',
  'della',
  'des',
  'di',
  'do',
  'dos',
  'du',
  'la',
  'le',
  'lo',
  'van',
  'von',
  'der',
  'den',
  'ten',
  'ter',
]);

/** Trims and collapses inner whitespace. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Proposes the sort form of an author name: "Umberto Eco" becomes "Eco, Umberto".
 * A name that already contains a comma, or a single word, is returned as is.
 * It is only a default: the user can correct it.
 */
export function authorSortName(name: string): string {
  const clean = cleanText(name);
  if (clean.includes(',')) return clean;
  const words = clean.split(' ');
  if (words.length < 2) return clean;

  let surnameStart = words.length - 1;
  while (surnameStart > 1 && surnameParticles.has(words[surnameStart - 1]?.toLowerCase() ?? '')) surnameStart--;

  return `${words.slice(surnameStart).join(' ')}, ${words.slice(0, surnameStart).join(' ')}`;
}

function includes<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

/** Collects issues while turning the input into the payload. */
class Collector {
  readonly issues: CatalogIssue[] = [];

  add(path: string, code: CatalogIssueCode): void {
    this.issues.push({ path, code });
  }

  /** Required text: cleaned, non-empty, within the limit. */
  requiredText(path: string, value: string | undefined, max: number): string {
    const clean = value === undefined ? '' : cleanText(value);
    if (!clean) this.add(path, 'required');
    else if (clean.length > max) this.add(path, 'too_long');
    return clean;
  }

  /** Optional text: cleaned, `undefined` when empty. */
  optionalText(path: string, value: string | undefined, max: number, keepLines = false): string | undefined {
    if (value === undefined) return undefined;
    const clean = keepLines ? value.trim() : cleanText(value);
    if (!clean) return undefined;
    if (clean.length > max) this.add(path, 'too_long');
    return clean;
  }

  id(path: string, value: string): string {
    if (!uuidPattern.test(value)) this.add(path, 'invalid_id');
    return value.toLowerCase();
  }

  language(path: string, value: string | undefined): string | undefined {
    if (value === undefined || !value.trim()) return undefined;
    const clean = value.trim().toLowerCase();
    if (!languagePattern.test(clean)) this.add(path, 'invalid_language');
    return clean;
  }

  integer(
    path: string,
    value: number | undefined,
    min: number,
    max: number,
    code: CatalogIssueCode,
  ): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < min || value > max) this.add(path, code);
    return value;
  }

  option<T extends string>(path: string, options: readonly T[], value: T | undefined): T | undefined {
    if (value === undefined) return undefined;
    if (!includes(options, value)) this.add(path, 'invalid_option');
    return value;
  }

  fieldSources(path: string, value: FieldSources | undefined): FieldSources {
    const sources: FieldSources = {};
    for (const [field, source] of Object.entries(value ?? {})) {
      if (!includes(metadataSources, source)) this.add(`${path}.${field}`, 'invalid_option');
      sources[field] = source;
    }
    return sources;
  }

  externalIds(path: string, value: ExternalIdInput[] | undefined, allowGoogleBooks: boolean): ExternalIdPayload[] {
    const seen = new Set<string>();
    const ids: ExternalIdPayload[] = [];
    (value ?? []).forEach((externalId, i) => {
      const itemPath = `${path}.${i}`;
      if (!includes(externalIdSources, externalId.source)) this.add(`${itemPath}.source`, 'invalid_option');
      if (externalId.source === 'googlebooks' && !allowGoogleBooks) this.add(itemPath, 'googlebooks_not_storable');
      const idValue = this.requiredText(`${itemPath}.value`, externalId.value, limits.externalId);
      const key = `${externalId.source}:${idValue}`;
      if (seen.has(key)) {
        this.add(itemPath, 'duplicate');
        return;
      }
      seen.add(key);
      const payload: ExternalIdPayload = { source: externalId.source, value: idValue };
      // Google Books content is never stored: keep only the volume id.
      if (externalId.raw !== undefined && externalId.raw !== null && externalId.source !== 'googlebooks') {
        payload.raw = externalId.raw;
      }
      ids.push(payload);
    });
    return ids;
  }
}

function validateAuthors(c: Collector, authors: AuthorInput[]): AuthorPayload[] {
  const seenIds = new Set<string>();
  return authors.map((author, i) => {
    const path = `work.authors.${i}`;
    if ('id' in author) {
      const id = c.id(`${path}.id`, author.id);
      if (seenIds.has(id)) c.add(path, 'duplicate');
      seenIds.add(id);
      return { id };
    }
    const name = c.requiredText(`${path}.name`, author.name, limits.name);
    const sortName =
      c.optionalText(`${path}.sortName`, author.sortName, limits.name) ?? (name ? authorSortName(name) : name);
    const alternateNames = [
      ...new Set((author.alternateNames ?? []).map(cleanText).filter((alt) => alt && alt !== name)),
    ];
    return {
      name,
      sort_name: sortName,
      alternate_names: alternateNames,
      external_ids: c.externalIds(`${path}.externalIds`, author.externalIds, false),
    };
  });
}

function validateWork(c: Collector, work: WorkInput): CatalogEntryPayload['work'] {
  if ('id' in work) return { id: c.id('work.id', work.id) };

  const fieldSources = c.fieldSources('work.fieldSources', work.fieldSources);
  if (fieldSources.description === 'googlebooks') c.add('work.description', 'googlebooks_not_storable');

  return {
    title: c.requiredText('work.title', work.title, limits.title),
    original_title: c.optionalText('work.originalTitle', work.originalTitle, limits.title),
    original_language: c.language('work.originalLanguage', work.originalLanguage),
    first_published_year: c.integer('work.firstPublishedYear', work.firstPublishedYear, -3000, 2100, 'invalid_year'),
    description: c.optionalText('work.description', work.description, limits.description, true),
    field_sources: fieldSources,
    external_ids: c.externalIds('work.externalIds', work.externalIds, false),
    authors: validateAuthors(c, work.authors),
  };
}

function validateEdition(c: Collector, edition: EditionInput): EditionPayload {
  let isbn13: string | undefined;
  if (edition.isbn !== undefined && edition.isbn.trim()) {
    isbn13 = toIsbn13(edition.isbn) ?? undefined;
    if (!isbn13) c.add('edition.isbn', 'invalid_isbn');
  }

  const coverSource = c.option('edition.coverSource', coverSources, edition.coverSource);
  const coverId = c.optionalText('edition.coverId', edition.coverId, limits.coverId);
  const coverPath = c.optionalText('edition.coverPath', edition.coverPath, limits.coverPath);
  if ((coverSource === 'openlibrary' || coverSource === 'googlebooks') && !coverId) {
    c.add('edition.coverId', 'missing_cover_reference');
  }
  if (coverSource === 'upload' && !coverPath) c.add('edition.coverPath', 'missing_cover_reference');

  const seenContributors = new Set<string>();
  const contributors: ContributorInput[] = [];
  (edition.contributors ?? []).forEach((contributor, i) => {
    const path = `edition.contributors.${i}`;
    const name = c.requiredText(`${path}.name`, contributor.name, limits.name);
    const role = c.option(`${path}.role`, contributorRoles, contributor.role) ?? contributor.role;
    const key = `${role}:${name.toLowerCase()}`;
    if (seenContributors.has(key)) {
      c.add(path, 'duplicate');
      return;
    }
    seenContributors.add(key);
    contributors.push({ name, role });
  });

  return {
    title: c.optionalText('edition.title', edition.title, limits.title),
    isbn13,
    language: c.language('edition.language', edition.language),
    publisher: c.optionalText('edition.publisher', edition.publisher, limits.publisher),
    published_year: c.integer('edition.publishedYear', edition.publishedYear, 1450, 2100, 'invalid_year'),
    format: c.option('edition.format', editionFormats, edition.format),
    page_count: c.integer('edition.pageCount', edition.pageCount, 1, 100000, 'invalid_page_count'),
    cover_source: coverSource,
    cover_id: coverId,
    cover_path: coverPath,
    metadata_status: c.option('edition.metadataStatus', metadataStatuses, edition.metadataStatus),
    field_sources: c.fieldSources('edition.fieldSources', edition.fieldSources),
    contributors,
    external_ids: c.externalIds('edition.externalIds', edition.externalIds, true),
  };
}

/** Drops `undefined` keys, so the JSON sent to the database only has the fields that were given. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Validates and normalises a new catalog entry. On success, `entry` is the body
 * for `public.create_edition`; otherwise `issues` lists every problem found.
 */
export function validateCatalogEntry(input: CatalogEntryInput): CatalogValidation {
  const c = new Collector();
  const work = validateWork(c, input.work);
  const edition = validateEdition(c, input.edition);
  if (c.issues.length > 0) return { ok: false, issues: c.issues };
  return { ok: true, entry: { work: compact(work), edition: compact(edition) } };
}

export type CoverSize = 'small' | 'medium' | 'large';

const openLibrarySizes: Record<CoverSize, string> = { small: 'S', medium: 'M', large: 'L' };
const googleBooksZoom: Record<CoverSize, number> = { small: 5, medium: 1, large: 2 };

/**
 * URL of a cover that is loaded live from its source: images are never copied (ADR-0008).
 * Uploaded and generated covers are not served from an id, so they return `null`.
 */
export function coverUrl(source: CoverSource, id: string, size: CoverSize = 'medium'): string | null {
  const encoded = encodeURIComponent(id);
  switch (source) {
    case 'openlibrary':
      return `https://covers.openlibrary.org/b/id/${encoded}-${openLibrarySizes[size]}.jpg`;
    case 'googlebooks':
      return `https://books.google.com/books/content?id=${encoded}&printsec=frontcover&img=1&zoom=${googleBooksZoom[size]}`;
    case 'upload':
    case 'generated':
      return null;
  }
}
