import { describe, expect, it } from 'vitest';

import { parseCsv, parseGoodreadsExport, plannedReadings, stripSeries, summarizeGoodreads } from './goodreads';

// An invented export with the columns of a real one (November 2026), in a shuffled order
// to prove that columns are read by name. No real library data.
const header =
  'Title,Book Id,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';

const rows = [
  // Read twice, rated, with a review in HTML and two shelves.
  '"La topina, il fungo e la luna (Sottobosco, #1)",101,Ada Muskio,"Muskio, Ada",Bruno Tradu,"=""8806123459""","=""9788806123451""",4,Edizioni Sottobosco,Paperback,212,2019,1957,2024/03/18,2024/01/02,"comodino, da-rileggere, read","comodino (#3), da-rileggere (#1), read (#40)",read,"Bellissimo.<br/><br/>Da rileggere, con calma.",,Prestato a Carla,2,0',
  // To read, without ISBN, owned.
  'Il bosco senza codice,102,Carla Ghianda,"Ghianda, Carla",,"=""""","=""""",0,,Hardcover,,,,,2025/05/01,to-read,to-read (#2),to-read,,,,0,1',
  // Read, no date, no rating.
  'La radura,103,Bruno Felce,"Felce, Bruno",,"=""""","=""9791234567896""",0,,,,,,,2023/02/02,read,read (#1),read,,,,1,0',
  // Did not finish, a custom exclusive shelf.
  'Il fungo che non finisce,104,Dora Spora,"Spora, Dora",,,,2,,,,,,,2023/02/02,did-not-finish,did-not-finish (#1),did-not-finish,,,,0,0',
  // A custom exclusive shelf that is not "did not finish", and a mistyped ISBN.
  'Il libro del prestito,105,Ezio Muschio,"Muschio, Ezio",,"=""1234567890""",,0,,,,,,,2023/02/02,prestati,prestati (#1),prestati,,,,0,0',
  // A row without title.
  ',106,Nessuno,,,,,0,,,,,,,2023/02/02,to-read,,to-read,,,,0,0',
];

const csv = [header, ...rows].join('\r\n') + '\r\n';

describe('parseCsv', () => {
  it('keeps commas, doubled quotes and line breaks inside quotes', () => {
    expect(parseCsv('a,"b, c","d ""e""","f\ng"\n1,2,3,4\n\n')).toEqual([
      ['a', 'b, c', 'd "e"', 'f\ng'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('ignores a byte order mark and a missing final line break', () => {
    expect(parseCsv('﻿x,y\r\n1,2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('parseGoodreadsExport', () => {
  const parsed = parseGoodreadsExport(csv);
  if (!parsed.ok) throw new Error('the fixture should parse');
  const [topina, bosco, radura, fungo, prestito] = parsed.books;

  it('reads columns by name and cleans ISBNs, ratings and dates', () => {
    expect(topina).toMatchObject({
      line: 2,
      goodreadsId: '101',
      title: 'La topina, il fungo e la luna (Sottobosco, #1)',
      searchTitle: 'La topina, il fungo e la luna',
      author: 'Ada Muskio',
      isbn13: '9788806123451',
      publisher: 'Edizioni Sottobosco',
      pageCount: 212,
      publishedYear: 2019,
      originalYear: 1957,
      status: 'read',
      ratingQuarter: 16,
      finishedOn: '2024-03-18',
      readCount: 2,
      shelves: ['comodino', 'da rileggere'],
      review: 'Bellissimo.\n\nDa rileggere, con calma.\n\nPrestato a Carla',
    });
  });

  it('never guesses: no rating is null, no date stays empty, Date Added is never used', () => {
    expect(bosco).toMatchObject({ status: 'want', isbn13: null, ratingQuarter: null, finishedOn: null, copies: 1 });
    expect(radura).toMatchObject({ status: 'read', ratingQuarter: null, finishedOn: null, readCount: 1 });
  });

  it('takes every book read as owned, and only those or the ones with copies', () => {
    expect([topina, bosco, radura, fungo, prestito].map((book) => book?.copies)).toEqual([1, 1, 1, 0, 0]);
  });

  it('turns "did not finish" shelves into "Messo da parte" and keeps other exclusive shelves as shelves', () => {
    expect(fungo).toMatchObject({ status: 'abandoned', ratingQuarter: 8, shelves: [] });
    expect(prestito).toMatchObject({ status: null, shelves: ['prestati'], isbn13: null });
  });

  it('reports what it could not use instead of dropping it', () => {
    expect(parsed.books).toHaveLength(5);
    expect(parsed.issues).toEqual([
      { line: 6, code: 'custom_shelf', shelf: 'prestati' },
      { line: 6, code: 'invalid_isbn' },
      { line: 7, code: 'missing_title' },
    ]);
  });

  it('refuses a file that is not a Goodreads export', () => {
    expect(parseGoodreadsExport('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseGoodreadsExport('titolo,autore\nA,B')).toEqual({ ok: false, reason: 'not_goodreads' });
  });
});

describe('plannedReadings', () => {
  const parsed = parseGoodreadsExport(csv);
  const books = parsed.ok ? parsed.books : [];

  it('gives the latest reading its date, rating and notes, and earlier reads none', () => {
    expect(plannedReadings(books[0]!)).toEqual([
      {
        status: 'read',
        finishedOn: '2024-03-18',
        ratingQuarter: 16,
        review: 'Bellissimo.\n\nDa rileggere, con calma.\n\nPrestato a Carla',
      },
      { status: 'read' },
    ]);
    expect(plannedReadings(books[1]!)).toEqual([{ status: 'want' }]);
    expect(plannedReadings(books[4]!)).toEqual([]);
  });
});

describe('summarizeGoodreads', () => {
  it('counts what would come in', () => {
    const parsed = parseGoodreadsExport(csv);
    expect(summarizeGoodreads(parsed.ok ? parsed.books : [])).toEqual({
      books: 5,
      withIsbn: 2,
      byStatus: { want: 1, reading: 0, read: 2, abandoned: 1 },
      rated: 2,
      readWithoutDate: 1,
      rereads: 1,
      copies: 3,
      shelves: [
        { name: 'comodino', books: 1 },
        { name: 'da rileggere', books: 1 },
        { name: 'prestati', books: 1 },
      ],
    });
  });
});

describe('stripSeries', () => {
  it('removes only a trailing series with a number', () => {
    expect(stripSeries('Dune (Dune, #1)')).toBe('Dune');
    expect(stripSeries('Il barone (rampante)')).toBe('Il barone (rampante)');
  });
});
