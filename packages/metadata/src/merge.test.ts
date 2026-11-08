import { validateCatalogEntry } from '@libresca/domain';
import { describe, expect, it } from 'vitest';

import { googleBooksResponse, italianIsbn, openLibraryDetails, openLibraryWork, sbnFull } from './fixtures/responses';
import { parseGoogleBooks } from './googlebooks';
import { mergeRecords, proposalToCatalogEntry } from './merge';
import { openLibraryEdition, parseOpenLibrary } from './openlibrary';
import { parseSbn } from './sbn';
import type { SourceRecord } from './types';

function records() {
  const edition = openLibraryEdition(italianIsbn, openLibraryDetails);
  const ol = edition && parseOpenLibrary(edition, openLibraryWork);
  const gb = parseGoogleBooks(italianIsbn, googleBooksResponse);
  const sbn = parseSbn(sbnFull);
  if (!ol || !gb || !sbn) throw new Error('fixtures did not parse');
  return { ol, gb, sbn };
}

describe('mergeRecords', () => {
  it('follows the ADR-0008 priorities field by field', () => {
    const { ol, gb, sbn } = records();
    const proposal = mergeRecords(italianIsbn, [gb, ol, sbn]);

    expect(proposal).toMatchObject({
      isbn13: italianIsbn,
      title: { value: 'Il bosco dei funghi', source: 'sbn' },
      publisher: { value: 'Edizioni Sottobosco', source: 'sbn' },
      publishedYear: { value: 2019, source: 'sbn' },
      firstPublishedYear: { value: 1975, source: 'openlibrary' },
      pageCount: { value: 305, source: 'sbn', reliable: true },
      language: { value: 'it', source: 'sbn' },
      format: { value: 'paperback', source: 'openlibrary' },
      description: { source: 'openlibrary', storable: true },
      cover: { source: 'openlibrary', id: '4242', url: 'https://covers.openlibrary.org/b/id/4242-M.jpg' },
      authorsSource: 'sbn',
    });
    expect(proposal.contributors.map((c) => [c.name, c.role, c.source])).toEqual([
      ['Bruno Felce', 'translator', 'sbn'],
      ['Chiara Spora', 'illustrator', 'sbn'],
      ['Dario Lichene', 'illustrator', 'sbn'],
      ['Elena Muffa', 'other', 'sbn'],
    ]);
  });

  it('attaches the Open Library author id by surname and keeps its spelling as an alternate name', () => {
    const { ol, sbn } = records();
    const twin: SourceRecord = { ...ol, authors: [{ name: 'Ada Muschio', externalId: 'OL77A' }] };
    expect(mergeRecords(italianIsbn, [sbn, twin]).authors).toEqual([
      { name: 'Ada Muschio', alternateNames: [], externalIds: [{ source: 'openlibrary', value: 'OL77A' }] },
    ]);
    // Open Library writes "Muskio": a different surname is not the same person.
    expect(mergeRecords(italianIsbn, [sbn, ol]).authors).toEqual([
      { name: 'Ada Muschio', alternateNames: [], externalIds: [] },
    ]);
    const accented: SourceRecord = { ...ol, authors: [{ name: 'Adà Muschio', externalId: 'OL77A' }] };
    expect(mergeRecords(italianIsbn, [sbn, accented]).authors[0]?.alternateNames).toEqual([]);
    const initials: SourceRecord = { ...ol, authors: [{ name: 'A. Muschio', externalId: 'OL77A' }] };
    expect(mergeRecords(italianIsbn, [sbn, initials]).authors[0]?.alternateNames).toEqual(['A. Muschio']);
  });

  it('marks Google Books values: unreliable pages, description not storable, cover by volume id', () => {
    const { gb } = records();
    const proposal = mergeRecords(italianIsbn, [gb]);
    expect(proposal.pageCount).toEqual({ value: 298, source: 'googlebooks', reliable: false });
    expect(proposal.description).toMatchObject({ source: 'googlebooks', storable: false });
    expect(proposal.cover?.source).toBe('googlebooks');
    expect(proposal.contributors).toEqual([]);
  });

  it('lists every external id, without the Google Books payload', () => {
    const { ol, gb, sbn } = records();
    const proposal = mergeRecords(italianIsbn, [ol, gb, sbn]);
    expect(proposal.editionExternalIds.map((id) => [id.source, id.value, id.raw !== undefined])).toEqual([
      ['openlibrary', 'OL900M', true],
      ['googlebooks', 'vol_AbC-1', false],
      ['sbn', 'IT\\ICCU\\TO0\\1234567', true],
      ['goodreads', '123456', false],
    ]);
    expect(proposal.workExternalIds).toMatchObject([{ source: 'openlibrary', value: 'OL55W' }]);
  });
});

describe('proposalToCatalogEntry', () => {
  it('produces an entry that passes the catalog rules, with provenance', () => {
    const { ol, gb, sbn } = records();
    const entry = proposalToCatalogEntry(mergeRecords(italianIsbn, [ol, gb, sbn]));
    const validation = validateCatalogEntry(entry);

    expect(validation.ok).toBe(true);
    expect(entry.work).toMatchObject({
      title: 'Il bosco dei funghi',
      description: 'Una topina attraversa il bosco in cerca di spore.',
      fieldSources: { title: 'sbn', first_published_year: 'openlibrary', description: 'openlibrary', authors: 'sbn' },
    });
    expect(entry.edition).toMatchObject({
      isbn: italianIsbn,
      pageCount: 305,
      coverSource: 'openlibrary',
      coverId: '4242',
      metadataStatus: 'complete',
      fieldSources: { title: 'sbn', publisher: 'sbn', page_count: 'sbn', format: 'openlibrary' },
    });
  });

  it('never carries a Google Books description, and stays incomplete on Google Books data', () => {
    const { gb } = records();
    const entry = proposalToCatalogEntry(mergeRecords(italianIsbn, [gb]));
    expect(validateCatalogEntry(entry).ok).toBe(true);
    expect('description' in entry.work && entry.work.description).toBeUndefined();
    expect(entry.edition.metadataStatus).toBe('incomplete');
    expect(entry.edition.externalIds).toEqual([{ source: 'googlebooks', value: 'vol_AbC-1' }]);
  });
});
