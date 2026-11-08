import { describe, expect, it } from 'vitest';

import {
  type CatalogEntryInput,
  authorSortName,
  cleanText,
  coverUrl,
  maxSearchQueryLength,
  searchQuery,
  validateCatalogEntry,
} from './catalog';

const workId = 'aaaaaaaa-0000-4000-8000-000000000001';

function issuesOf(input: CatalogEntryInput) {
  const result = validateCatalogEntry(input);
  return result.ok ? [] : result.issues;
}

describe('cleanText', () => {
  it('composes accents sent as combining marks', () => {
    const decomposed = 'Se questo è un uomo';
    expect(cleanText(decomposed)).toBe('Se questo è un uomo');
    expect(cleanText(decomposed)).toHaveLength('Se questo è un uomo'.length);
  });
});

describe('searchQuery', () => {
  it('cleans a usable query', () => {
    expect(searchQuery('  il   barone  ')).toBe('il barone');
  });

  it('rejects queries too short or too long', () => {
    expect(searchQuery(null)).toBeNull();
    expect(searchQuery(' a ')).toBeNull();
    expect(searchQuery('x'.repeat(maxSearchQueryLength + 1))).toBeNull();
    expect(searchQuery('x'.repeat(maxSearchQueryLength))).not.toBeNull();
  });
});

describe('authorSortName', () => {
  it('puts the surname first', () => {
    expect(authorSortName('Umberto Eco')).toBe('Eco, Umberto');
    expect(authorSortName('  Italo   Calvino ')).toBe('Calvino, Italo');
    expect(authorSortName('Ursula K. Le Guin')).toBe('Le Guin, Ursula K.');
  });

  it('keeps surname particles with the surname', () => {
    expect(authorSortName('Erri De Luca')).toBe('De Luca, Erri');
    expect(authorSortName('Vincent van Gogh')).toBe('van Gogh, Vincent');
    expect(authorSortName('Daniele Del Giudice')).toBe('Del Giudice, Daniele');
  });

  it('leaves single names and names already in sort form alone', () => {
    expect(authorSortName('Omero')).toBe('Omero');
    expect(authorSortName('Eco, Umberto')).toBe('Eco, Umberto');
  });

  it('never treats the first word as a particle', () => {
    expect(authorSortName('De Amicis')).toBe('Amicis, De');
  });
});

describe('validateCatalogEntry', () => {
  it('normalises a new work and edition into the database payload', () => {
    const result = validateCatalogEntry({
      work: {
        title: '  Il nome   della rosa ',
        originalLanguage: 'IT',
        firstPublishedYear: 1980,
        description: '  Un giallo.\n\nIn un monastero.  ',
        fieldSources: { title: 'sbn' },
        authors: [{ name: 'Umberto Eco', alternateNames: ['Umberto Eco', ' U. Eco '] }],
      },
      edition: {
        isbn: '88-452-9261-4',
        language: 'it',
        pageCount: 624,
        coverSource: 'openlibrary',
        coverId: '123',
        contributors: [{ name: ' Traduttrice  Inventata ', role: 'translator' }],
        externalIds: [{ source: 'sbn', value: 'IT\\ICCU\\X', raw: { bid: 'X' } }],
      },
    });

    expect(result).toEqual({
      ok: true,
      entry: {
        work: {
          title: 'Il nome della rosa',
          original_language: 'it',
          first_published_year: 1980,
          description: 'Un giallo.\n\nIn un monastero.',
          field_sources: { title: 'sbn' },
          external_ids: [],
          authors: [{ name: 'Umberto Eco', sort_name: 'Eco, Umberto', alternate_names: ['U. Eco'], external_ids: [] }],
        },
        edition: {
          isbn13: '9788845292613',
          language: 'it',
          page_count: 624,
          cover_source: 'openlibrary',
          cover_id: '123',
          field_sources: {},
          contributors: [{ name: 'Traduttrice Inventata', role: 'translator' }],
          external_ids: [{ source: 'sbn', value: 'IT\\ICCU\\X', raw: { bid: 'X' } }],
        },
      },
    });
  });

  it('accepts an existing work by id', () => {
    const result = validateCatalogEntry({ work: { id: workId.toUpperCase() }, edition: { title: 'Seconda edizione' } });
    expect(result).toEqual({
      ok: true,
      entry: {
        work: { id: workId },
        edition: { title: 'Seconda edizione', field_sources: {}, contributors: [], external_ids: [] },
      },
    });
  });

  it('keeps an explicit sort name', () => {
    const result = validateCatalogEntry({
      work: { title: 'Opera', authors: [{ name: 'Gabriel García Márquez', sortName: 'García Márquez, Gabriel' }] },
      edition: {},
    });
    expect(result.ok && result.entry.work).toMatchObject({ authors: [{ sort_name: 'García Márquez, Gabriel' }] });
  });

  it('stores only the volume id from Google Books', () => {
    const result = validateCatalogEntry({
      work: { id: workId },
      edition: { externalIds: [{ source: 'googlebooks', value: 'vol1', raw: { volumeInfo: {} } }] },
    });
    expect(result.ok && result.entry.edition.external_ids).toEqual([{ source: 'googlebooks', value: 'vol1' }]);
  });

  it('refuses Google Books content that cannot be stored', () => {
    expect(
      issuesOf({
        work: {
          title: 'Opera',
          fieldSources: { description: 'googlebooks' },
          externalIds: [{ source: 'googlebooks', value: 'vol1' }],
          authors: [{ name: 'Autrice', externalIds: [{ source: 'googlebooks', value: 'vol2' }] }],
        },
        edition: {},
      }),
    ).toEqual([
      { path: 'work.description', code: 'googlebooks_not_storable' },
      { path: 'work.externalIds.0', code: 'googlebooks_not_storable' },
      { path: 'work.authors.0.externalIds.0', code: 'googlebooks_not_storable' },
    ]);
  });

  it('reports every invalid field with its path', () => {
    expect(
      issuesOf({
        work: { title: '   ', originalLanguage: 'italiano', firstPublishedYear: 2200.5, authors: [{ name: '' }] },
        edition: {
          isbn: '8845292615',
          language: 'it-IT',
          publishedYear: 1200,
          pageCount: 0,
          format: 'scroll' as never,
          publisher: 'x'.repeat(201),
        },
      }),
    ).toEqual([
      { path: 'work.title', code: 'required' },
      { path: 'work.originalLanguage', code: 'invalid_language' },
      { path: 'work.firstPublishedYear', code: 'invalid_year' },
      { path: 'work.authors.0.name', code: 'required' },
      { path: 'edition.isbn', code: 'invalid_isbn' },
      { path: 'edition.language', code: 'invalid_language' },
      { path: 'edition.publisher', code: 'too_long' },
      { path: 'edition.publishedYear', code: 'invalid_year' },
      { path: 'edition.format', code: 'invalid_option' },
      { path: 'edition.pageCount', code: 'invalid_page_count' },
    ]);
  });

  it('requires the reference that matches the cover source', () => {
    expect(issuesOf({ work: { id: workId }, edition: { coverSource: 'openlibrary' } })).toEqual([
      { path: 'edition.coverId', code: 'missing_cover_reference' },
    ]);
    expect(issuesOf({ work: { id: workId }, edition: { coverSource: 'upload', coverId: '1' } })).toEqual([
      { path: 'edition.coverPath', code: 'missing_cover_reference' },
    ]);
    expect(issuesOf({ work: { id: workId }, edition: { coverSource: 'generated' } })).toEqual([]);
  });

  it('accepts only paths of uploaded cover photos', () => {
    const path = '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.jpg';
    expect(issuesOf({ work: { id: workId }, edition: { coverSource: 'upload', coverPath: path } })).toEqual([]);
    expect(
      issuesOf({ work: { id: workId }, edition: { coverSource: 'upload', coverPath: 'https://example.com/a.jpg' } }),
    ).toEqual([{ path: 'edition.coverPath', code: 'invalid_cover_path' }]);
  });

  it('refuses malformed ids and repeated entries', () => {
    expect(
      issuesOf({
        work: { title: 'Opera', authors: [{ id: 'not-a-uuid' }, { id: workId }, { id: workId }] },
        edition: {
          contributors: [
            { name: 'Ada', role: 'translator' },
            { name: 'ada', role: 'translator' },
            { name: 'Ada', role: 'editor' },
          ],
          externalIds: [
            { source: 'openlibrary', value: 'OL1M' },
            { source: 'openlibrary', value: ' OL1M' },
          ],
        },
      }),
    ).toEqual([
      { path: 'work.authors.0.id', code: 'invalid_id' },
      { path: 'work.authors.2', code: 'duplicate' },
      { path: 'edition.contributors.1', code: 'duplicate' },
      { path: 'edition.externalIds.1', code: 'duplicate' },
    ]);
  });

  it('refuses unknown field sources', () => {
    expect(issuesOf({ work: { id: workId }, edition: { fieldSources: { title: 'wikipedia' as never } } })).toEqual([
      { path: 'edition.fieldSources.title', code: 'invalid_option' },
    ]);
  });
});

describe('coverUrl', () => {
  it('builds live URLs from the cover id', () => {
    expect(coverUrl('openlibrary', '13774674')).toBe('https://covers.openlibrary.org/b/id/13774674-M.jpg');
    expect(coverUrl('openlibrary', '1', 'large')).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
    expect(coverUrl('googlebooks', 'ab_C-1', 'small')).toBe(
      'https://books.google.com/books/content?id=ab_C-1&printsec=frontcover&img=1&zoom=5',
    );
  });

  it('has no URL for uploaded or generated covers', () => {
    expect(coverUrl('upload', 'x')).toBeNull();
    expect(coverUrl('generated', 'x')).toBeNull();
  });
});
