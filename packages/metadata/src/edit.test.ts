import { validateCatalogEntry } from '@libresca/domain';
import { describe, expect, it } from 'vitest';

import {
  applyEdits,
  candidateProposal,
  editedCatalogEntry,
  editsFromProposal,
  emptyProposal,
  openLibraryAuthorIds,
} from './edit';
import { italianIsbn, openLibraryDetails, openLibraryWork, sbnFull } from './fixtures/responses';
import { mergeRecords } from './merge';
import { openLibraryEdition, parseOpenLibrary } from './openlibrary';
import { parseSbn } from './sbn';
import type { CandidateEdition, WorkCandidate } from './search';

function proposal() {
  const edition = openLibraryEdition(italianIsbn, openLibraryDetails);
  const ol = edition && parseOpenLibrary(edition, openLibraryWork);
  const sbn = parseSbn(sbnFull);
  if (!ol || !sbn) throw new Error('fixtures did not parse');
  return mergeRecords(italianIsbn, [ol, sbn]);
}

/** Open Library alone: its authors carry Open Library ids. */
function openLibraryProposal() {
  const edition = openLibraryEdition(italianIsbn, openLibraryDetails);
  const ol = edition && parseOpenLibrary(edition, openLibraryWork);
  if (!ol) throw new Error('fixture did not parse');
  return mergeRecords(italianIsbn, [ol]);
}

describe('editsFromProposal', () => {
  it('fills the form with the proposed values', () => {
    expect(editsFromProposal(proposal())).toEqual({
      title: 'Il bosco dei funghi',
      authors: ['Ada Muschio'],
      publisher: 'Edizioni Sottobosco',
      publishedYear: '2019',
      pageCount: '305',
      format: 'paperback',
      language: 'it',
      translators: ['Bruno Felce'],
    });
    expect(editsFromProposal(emptyProposal())).toEqual({
      title: '',
      authors: [],
      publisher: '',
      publishedYear: '',
      pageCount: '',
      format: '',
      language: 'it',
      translators: [],
    });
  });
});

describe('applyEdits', () => {
  it('keeps the sources of untouched fields', () => {
    const original = proposal();
    expect(applyEdits(original, editsFromProposal(original))).toEqual(original);
  });

  it('marks corrected fields as typed by the user and clears emptied ones', () => {
    const original = proposal();
    const result = applyEdits(original, {
      ...editsFromProposal(original),
      title: '  Il bosco   dei funghetti ',
      pageCount: '310',
      publisher: '',
    });
    expect(result.title).toEqual({ value: 'Il bosco dei funghetti', source: 'user' });
    expect(result.pageCount).toEqual({ value: 310, source: 'user', reliable: true });
    expect(result.publisher).toBeUndefined();
    expect(result.publishedYear).toEqual(original.publishedYear);
  });

  it('keeps the ids of an author the sources gave, even with different case', () => {
    const original = openLibraryProposal();
    const result = applyEdits(original, { ...editsFromProposal(original), authors: ['Nuova Voce', 'ada muskio'] });
    expect(result.authorsSource).toBe('user');
    expect(result.authors[0]).toEqual({ name: 'Nuova Voce', alternateNames: [], externalIds: [] });
    expect(result.authors[1]?.externalIds).toEqual([{ source: 'openlibrary', value: 'OL77A' }]);
  });
});

describe('editedCatalogEntry', () => {
  it('passes validation for a confirmed proposal', () => {
    const original = proposal();
    const entry = editedCatalogEntry(original, editsFromProposal(original));
    expect(validateCatalogEntry(entry).ok).toBe(true);
    expect(entry.edition.fieldSources).toMatchObject({ title: 'sbn', page_count: 'sbn' });
  });

  it('records corrections in field_sources', () => {
    const original = proposal();
    const entry = editedCatalogEntry(original, { ...editsFromProposal(original), publishedYear: '2020' });
    expect(entry.edition.publishedYear).toBe(2020);
    expect(entry.edition.fieldSources?.published_year).toBe('user');
  });

  it('lets the validator reject a year that is not a number', () => {
    const original = proposal();
    const entry = editedCatalogEntry(original, { ...editsFromProposal(original), publishedYear: 'duemila' });
    const result = validateCatalogEntry(entry);
    expect(result.ok ? [] : result.issues).toContainEqual({ path: 'edition.publishedYear', code: 'invalid_year' });
  });

  it('adds the edition to an existing work, keeping the typed title on the edition', () => {
    const original = proposal();
    const workId = 'aaaaaaaa-0000-4000-8000-000000000001';
    const entry = editedCatalogEntry(
      original,
      { ...editsFromProposal(original), title: 'Titolo dell edizione' },
      {
        workId,
      },
    );
    expect(entry.work).toEqual({ id: workId });
    expect(entry.edition.title).toBe('Titolo dell edizione');
    expect(validateCatalogEntry(entry).ok).toBe(true);
  });

  it('reuses a catalog author with the same Open Library id', () => {
    const original = openLibraryProposal();
    expect(openLibraryAuthorIds(original)).toEqual(['OL77A']);
    const authorId = 'bbbbbbbb-0000-4000-8000-000000000002';
    const entry = editedCatalogEntry(original, editsFromProposal(original), { knownAuthors: { OL77A: authorId } });
    expect('authors' in entry.work && entry.work.authors).toEqual([{ id: authorId }]);
  });

  it('saves a book typed by hand', () => {
    const entry = editedCatalogEntry(emptyProposal(italianIsbn), {
      title: 'Appunti di micologia',
      authors: ['Chiara Spora', ' '],
      publisher: 'Lichene',
      publishedYear: '1999',
      pageCount: '',
      format: 'hardcover',
      language: 'it',
      translators: ['Bruno Felce'],
    });
    expect(validateCatalogEntry(entry).ok).toBe(true);
    expect(entry.work).toMatchObject({
      title: 'Appunti di micologia',
      fieldSources: { title: 'user', authors: 'user' },
    });
    expect(entry.edition).toMatchObject({
      isbn: italianIsbn,
      format: 'hardcover',
      language: 'it',
      metadataStatus: 'incomplete',
      contributors: [{ name: 'Bruno Felce', role: 'translator' }],
      fieldSources: { language: 'user' },
    });
  });

  it('replaces the source cover with the uploaded photo', () => {
    const original = proposal();
    const coverPhoto = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg';
    const entry = editedCatalogEntry(original, { ...editsFromProposal(original), coverPhoto });
    expect(entry.edition).toMatchObject({ coverSource: 'upload', coverPath: coverPhoto, coverId: undefined });
    expect(validateCatalogEntry(entry).ok).toBe(true);
  });

  it('keeps the translators the sources gave, or records the typed ones', () => {
    const original = proposal();
    const same = applyEdits(original, editsFromProposal(original));
    expect(same.contributors).toEqual(original.contributors);
    const changed = applyEdits(original, { ...editsFromProposal(original), translators: ['Elena Muffa '] });
    expect(changed.contributors.filter((c) => c.role === 'translator')).toEqual([
      { name: 'Elena Muffa', role: 'translator', source: 'user' },
    ]);
    expect(changed.contributors.filter((c) => c.role !== 'translator')).toHaveLength(
      original.contributors.filter((c) => c.role !== 'translator').length,
    );
  });
});

describe('candidateProposal', () => {
  const candidate: WorkCandidate = {
    key: 'openlibrary:OL99W',
    title: 'Il funghetto è nel bosco',
    authors: ['Bruno Felce'],
    firstPublishedYear: 1981,
    openLibraryWorkId: 'OL99W',
    editions: [],
    sources: ['openlibrary', 'googlebooks'],
  };

  it('keeps the Open Library work id and the edition id, with their source', () => {
    const edition: CandidateEdition = { source: 'openlibrary', editionId: 'OL430M', publishedYear: 1984 };
    const result = candidateProposal(candidate, edition);
    expect(result).toMatchObject({
      isbn13: undefined,
      title: { value: 'Il funghetto è nel bosco', source: 'openlibrary' },
      publishedYear: { value: 1984, source: 'openlibrary' },
      firstPublishedYear: { value: 1981, source: 'openlibrary' },
      editionExternalIds: [{ source: 'openlibrary', value: 'OL430M' }],
      workExternalIds: [{ source: 'openlibrary', value: 'OL99W' }],
    });
    expect(validateCatalogEntry(editedCatalogEntry(result, editsFromProposal(result))).ok).toBe(true);
  });

  it('stores only the volume id for a Google Books edition', () => {
    const edition: CandidateEdition = { source: 'googlebooks', editionId: 'vol_1', title: 'Il funghetto' };
    const entry = editedCatalogEntry(
      candidateProposal(candidate, edition),
      editsFromProposal(candidateProposal(candidate, edition)),
    );
    expect(entry.edition.externalIds).toEqual([{ source: 'googlebooks', value: 'vol_1' }]);
    expect(validateCatalogEntry(entry).ok).toBe(true);
  });
});
