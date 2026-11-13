import { describe, expect, it } from 'vitest';

import {
  type TanaCopyRow,
  type TanaReadingRow,
  type TanaWork,
  buildTana,
  editionCoverUrl,
  foldText,
  matchesTana,
  sortTana,
  tanaCounts,
} from './tana';

const work = (id: string, title: string, author = 'Italo Calvino', sortName: string | null = null): TanaWork => ({
  id,
  title,
  authors: [{ name: author, sort_name: sortName }],
  editions: [
    { id: `${id}-a`, cover_source: null, cover_id: null, cover_path: null },
    { id: `${id}-b`, cover_source: 'openlibrary', cover_id: '42', cover_path: null },
  ],
});

const copy = (w: TanaWork, created: string, extra: Partial<TanaCopyRow> = {}): TanaCopyRow => ({
  edition_id: `${w.id}-a`,
  is_lendable: false,
  created_at: created,
  work: w,
  ...extra,
});

const reading = (w: TanaWork, created: string, extra: Partial<TanaReadingRow> = {}): TanaReadingRow => ({
  status: 'read',
  started_on: null,
  finished_on: null,
  rating_half: null,
  edition_id: null,
  created_at: created,
  work: w,
  ...extra,
});

const citta = work('w1', 'Le città invisibili', 'Italo Calvino', 'Calvino, Italo');
const rosa = work('w2', 'Il nome della rosa', 'Umberto Eco', 'Eco, Umberto');
const lezioni = work('w3', 'Lezioni americane', 'Italo Calvino', 'Calvino, Italo');

describe('buildTana', () => {
  it('puts copies and readings of the same work in one book, without merging them', () => {
    const [book, ...rest] = buildTana(
      [copy(citta, '2026-01-02T10:00:00Z', { is_lendable: true }), copy(citta, '2026-03-01T10:00:00Z')],
      [
        reading(citta, '2026-01-05T10:00:00Z', { finished_on: '2019-05-01', rating_half: 7 }),
        reading(citta, '2026-02-01T10:00:00Z', { finished_on: '2024-03-18', rating_half: 9 }),
        reading(citta, '2026-04-01T10:00:00Z', { status: 'reading', started_on: '2026-04-01' }),
      ],
    );
    expect(rest).toEqual([]);
    expect(book).toMatchObject({
      workId: 'w1',
      authors: ['Italo Calvino'],
      authorSort: 'Calvino, Italo',
      copies: 2,
      lendable: true,
      status: 'reading',
      readCount: 2,
      ratingHalf: 9,
      lastFinishedOn: '2024-03-18',
      addedAt: '2026-01-02T10:00:00Z',
    });
  });

  it('keeps books read but not owned, and books only on a shelf', () => {
    const books = buildTana(
      [],
      [reading(rosa, '2026-01-01T00:00:00Z')],
      [
        { shelf_id: 's1', created_at: '2026-02-01T00:00:00Z', work: lezioni },
        { shelf_id: 's2', created_at: '2026-02-02T00:00:00Z', work: lezioni },
      ],
    );
    expect(books.map((book) => [book.workId, book.copies, book.status, book.shelfIds])).toEqual([
      ['w2', 0, 'read', []],
      ['w3', 0, null, ['s1', 's2']],
    ]);
  });

  it("prefers the cover of the copy's edition, then the reading's, then any", () => {
    const withCovers: TanaWork = {
      ...citta,
      editions: [
        { id: 'own', cover_source: 'upload', cover_id: null, cover_path: 'a/b.jpg' },
        { id: 'read', cover_source: 'googlebooks', cover_id: 'g', cover_path: null },
        { id: 'any', cover_source: 'openlibrary', cover_id: '1', cover_path: null },
      ],
    };
    const owned = buildTana([copy(withCovers, '2026-01-01T00:00:00Z', { edition_id: 'own' })], []);
    expect(owned[0]?.coverEdition?.id).toBe('own');
    const read = buildTana([], [reading(withCovers, '2026-01-01T00:00:00Z', { edition_id: 'read' })]);
    expect(read[0]?.coverEdition?.id).toBe('read');
    expect(buildTana([copy(citta, '2026-01-01T00:00:00Z')], [])[0]?.coverEdition?.id).toBe('w1-b');
  });
});

describe('editionCoverUrl', () => {
  it('builds the URL of a photo or of a live cover, and nothing otherwise', () => {
    const base = { cover_id: null, cover_path: null };
    expect(editionCoverUrl({ ...base, cover_source: 'upload', cover_path: 'a/b.jpg' }, 'https://x.co/')).toBe(
      'https://x.co/storage/v1/object/public/covers/a/b.jpg',
    );
    expect(editionCoverUrl({ ...base, cover_source: 'openlibrary', cover_id: '42' }, '')).toContain('/b/id/42-M');
    expect(editionCoverUrl({ ...base, cover_source: 'generated' }, '')).toBeNull();
    expect(editionCoverUrl(null, '')).toBeNull();
  });
});

describe('matchesTana and tanaCounts', () => {
  const books = buildTana(
    [copy(citta, '2026-01-01T00:00:00Z', { is_lendable: true }), copy(rosa, '2026-01-02T00:00:00Z')],
    [
      reading(citta, '2026-01-01T00:00:00Z', { status: 'reading' }),
      reading(rosa, '2026-01-01T00:00:00Z'),
      reading(lezioni, '2026-01-01T00:00:00Z', { status: 'want' }),
    ],
  );
  const ids = (query: string, filters: Parameters<typeof matchesTana>[2]) =>
    books.filter((book) => matchesTana(book, query, filters)).map((book) => book.workId);

  it('searches titles and authors without accents or case', () => {
    expect(ids('CITTA', [])).toEqual(['w1']);
    expect(ids('calvino', [])).toEqual(['w1', 'w3']);
    expect(ids('  ', [])).toEqual(['w1', 'w2', 'w3']);
    expect(foldText('Àgata Funghétti')).toBe('agata funghetti');
  });

  it('widens with reading chips and narrows with copy chips', () => {
    expect(ids('', ['reading', 'want'])).toEqual(['w1', 'w3']);
    expect(ids('', ['owned'])).toEqual(['w1', 'w2']);
    expect(ids('', ['owned', 'lendable'])).toEqual(['w1']);
    expect(ids('', ['want', 'owned'])).toEqual([]);
    expect(ids('calvino', ['read'])).toEqual([]);
  });

  it('counts each chip on its own', () => {
    expect(tanaCounts(books)).toEqual({ reading: 1, read: 1, want: 1, abandoned: 0, owned: 2, lendable: 1 });
  });
});

describe('sortTana', () => {
  const books = buildTana(
    [copy(rosa, '2026-03-01T00:00:00Z'), copy(citta, '2026-01-01T00:00:00Z'), copy(lezioni, '2026-02-01T00:00:00Z')],
    [],
  );
  const order = (o: Parameters<typeof sortTana>[1]) => sortTana(books, o, 'it').map((book) => book.title);

  it('sorts by date added, title or author', () => {
    expect(order('recent')).toEqual(['Il nome della rosa', 'Lezioni americane', 'Le città invisibili']);
    expect(order('title')).toEqual(['Il nome della rosa', 'Le città invisibili', 'Lezioni americane']);
    expect(order('author')).toEqual(['Le città invisibili', 'Lezioni americane', 'Il nome della rosa']);
  });
});
