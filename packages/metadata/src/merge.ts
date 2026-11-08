import {
  type CatalogEntryInput,
  type ExternalIdInput,
  type FieldSources,
  type MetadataSource,
  coverUrl,
} from '@libresca/domain';

import { matchKey, surnameKey } from './text';
import type { EditionProposal, ProposalAuthor, SourceName, SourceRecord, Sourced } from './types';

/**
 * Field priorities from ADR-0008. SBN first for Italian bibliographic data and pages,
 * Open Library for open descriptions and covers, Google Books to fill the gaps.
 */
const bibliographic: SourceName[] = ['sbn', 'openlibrary', 'googlebooks'];
const openFirst: SourceName[] = ['openlibrary', 'googlebooks'];
const translators: SourceName[] = ['sbn', 'openlibrary'];

function bySource(records: SourceRecord[]): Map<SourceName, SourceRecord> {
  return new Map(records.map((record) => [record.source, record]));
}

function pick<T>(
  records: Map<SourceName, SourceRecord>,
  order: SourceName[],
  get: (record: SourceRecord) => T | undefined,
): Sourced<T> | undefined {
  for (const source of order) {
    const record = records.get(source);
    const value = record ? get(record) : undefined;
    if (value !== undefined) return { value, source };
  }
  return undefined;
}

/**
 * Authors from the first source that lists them. Open Library's author ids are attached
 * to the same person by surname; a different spelling becomes an alternate name.
 */
function mergeAuthors(records: Map<SourceName, SourceRecord>): Pick<EditionProposal, 'authors' | 'authorsSource'> {
  const chosen = pick(records, bibliographic, (record) => (record.authors.length > 0 ? record.authors : undefined));
  if (!chosen) return { authors: [] };

  const openLibrary = records.get('openlibrary')?.authors ?? [];
  const authors = chosen.value.map((author): ProposalAuthor => {
    const twin =
      chosen.source === 'openlibrary'
        ? author
        : openLibrary.find((ol) => surnameKey(ol.name) === surnameKey(author.name));
    const alternateNames = twin && matchKey(twin.name) !== matchKey(author.name) ? [twin.name] : [];
    const externalIds: ExternalIdInput[] = twin?.externalId ? [{ source: 'openlibrary', value: twin.externalId }] : [];
    return { name: author.name, alternateNames, externalIds };
  });
  return { authors, authorsSource: chosen.source };
}

function editionExternalIds(records: SourceRecord[]): ExternalIdInput[] {
  const ids: ExternalIdInput[] = records.map((record) =>
    // Google Books: the volume id only, never the payload.
    record.source === 'googlebooks' || record.raw === undefined
      ? { source: record.source, value: record.editionId }
      : { source: record.source, value: record.editionId, raw: record.raw },
  );
  const goodreads = new Set(records.flatMap((record) => record.goodreadsIds));
  for (const value of goodreads) ids.push({ source: 'goodreads', value });
  return ids;
}

/** Merges what the sources found into one proposal, field by field. */
export function mergeRecords(isbn13: string, list: SourceRecord[]): EditionProposal {
  const records = bySource(list);
  const openLibrary = records.get('openlibrary');

  const pageCount = pick(records, bibliographic, (record) => record.pageCount);
  const description = pick(records, openFirst, (record) => record.description);
  const cover = pick(records, openFirst, (record) => record.coverId);
  const contributorSource = pick(records, translators, (record) =>
    record.contributors.length > 0 ? record.contributors : undefined,
  );

  return {
    isbn13,
    title: pick(records, bibliographic, (record) => record.title),
    ...mergeAuthors(records),
    publisher: pick(records, bibliographic, (record) => record.publisher),
    publishedYear: pick(records, bibliographic, (record) => record.publishedYear),
    firstPublishedYear: pick(records, ['openlibrary'], (record) => record.firstPublishedYear),
    pageCount: pageCount && { ...pageCount, reliable: pageCount.source !== 'googlebooks' },
    language: pick(records, bibliographic, (record) => record.language),
    format: pick(records, ['openlibrary'], (record) => record.format),
    description: description && { ...description, storable: description.source !== 'googlebooks' },
    cover:
      cover && (cover.source === 'openlibrary' || cover.source === 'googlebooks')
        ? { source: cover.source, id: cover.value, url: coverUrl(cover.source, cover.value) ?? '' }
        : undefined,
    contributors: (contributorSource?.value ?? []).map((contributor) => ({
      ...contributor,
      source: contributorSource?.source ?? 'sbn',
    })),
    editionExternalIds: editionExternalIds(list),
    workExternalIds: openLibrary?.workId
      ? [
          openLibrary.workRaw === undefined
            ? { source: 'openlibrary', value: openLibrary.workId }
            : { source: 'openlibrary', value: openLibrary.workId, raw: openLibrary.workRaw },
        ]
      : [],
  };
}

/**
 * The catalog entry for a proposal accepted as is, with a new work. F1.3 lets the user
 * edit the fields first. Provenance goes to `field_sources`, so a later job can replace
 * Google Books values with open data; a Google Books description is never included.
 */
export function proposalToCatalogEntry(proposal: EditionProposal): CatalogEntryInput {
  const workSources: FieldSources = {};
  const editionSources: FieldSources = {};
  const note = (target: FieldSources, field: string, value: { source: MetadataSource } | undefined) => {
    if (value) target[field] = value.source;
  };

  const description = proposal.description?.storable ? proposal.description : undefined;
  note(workSources, 'title', proposal.title);
  note(workSources, 'first_published_year', proposal.firstPublishedYear);
  note(workSources, 'description', description);
  if (proposal.authorsSource) workSources.authors = proposal.authorsSource;
  note(editionSources, 'title', proposal.title);
  note(editionSources, 'publisher', proposal.publisher);
  note(editionSources, 'published_year', proposal.publishedYear);
  note(editionSources, 'page_count', proposal.pageCount);
  note(editionSources, 'language', proposal.language);
  note(editionSources, 'format', proposal.format);

  // Complete only when the essentials are there and none of them depends on Google Books.
  const essentials = [proposal.title, proposal.publisher, proposal.publishedYear, proposal.pageCount];
  const complete =
    proposal.authors.length > 0 &&
    proposal.authorsSource !== 'googlebooks' &&
    essentials.every((field) => field !== undefined && field.source !== 'googlebooks');

  return {
    work: {
      title: proposal.title?.value ?? '',
      firstPublishedYear: proposal.firstPublishedYear?.value,
      description: description?.value,
      fieldSources: workSources,
      externalIds: proposal.workExternalIds,
      authors: proposal.authors.map(({ name, alternateNames, externalIds }) => ({ name, alternateNames, externalIds })),
    },
    edition: {
      isbn: proposal.isbn13,
      language: proposal.language?.value,
      publisher: proposal.publisher?.value,
      publishedYear: proposal.publishedYear?.value,
      format: proposal.format?.value,
      pageCount: proposal.pageCount?.value,
      coverSource: proposal.cover?.source,
      coverId: proposal.cover?.id,
      metadataStatus: complete ? 'complete' : 'incomplete',
      fieldSources: editionSources,
      contributors: proposal.contributors.map(({ name, role }) => ({ name, role })),
      externalIds: proposal.editionExternalIds,
    },
  };
}
