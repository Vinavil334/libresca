import { describe, expect, it, vi } from 'vitest';

import {
  createEdition,
  findAuthorsByOpenLibraryIds,
  findWorksByIdentifiers,
  getEditionByIsbn,
  getWork,
  searchWorks,
} from './catalog';
import type { LibrescaClient } from './client';

type Result = { data: unknown; error: unknown };

/** Stand-in for the query builder: records filters and returns queued results in order. */
function fakeClient(results: Result[]) {
  const queue = [...results];
  const calls = { eq: [] as [string, unknown][], in: [] as [string, unknown[]][], rpc: [] as [string, unknown][] };
  const next = async () => queue.shift() ?? { data: null, error: null };
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return chain;
    },
    in: (column: string, values: unknown[]) => {
      calls.in.push([column, values]);
      return chain;
    },
    maybeSingle: next,
    then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => next().then(resolve, reject),
  };
  const client = {
    from: vi.fn(() => chain),
    rpc: vi.fn((name: string, args: unknown) => {
      calls.rpc.push([name, args]);
      return chain;
    }),
  } as unknown as LibrescaClient;
  return { client, calls };
}

const author = (id: string, name: string) => ({ id, name, sort_name: name, alternate_names: [] });

const workRow = {
  id: 'w1',
  title: 'Il nome della rosa',
  merged_into: null,
  work_authors: [
    { position: 1, author: author('a2', 'Seconda') },
    { position: 0, author: author('a1', 'Prima') },
  ],
};

describe('getEditionByIsbn', () => {
  it('does not query for an invalid ISBN', async () => {
    const { client } = fakeClient([]);
    expect(await getEditionByIsbn(client, '123')).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('looks up the ISBN-13 form and orders authors and contributors', async () => {
    const { client, calls } = fakeClient([
      {
        data: {
          id: 'e1',
          isbn13: '9788845292613',
          contributors: [
            { name: 'B', role: 'editor', position: 1 },
            { name: 'A', role: 'translator', position: 0 },
          ],
          work: workRow,
        },
        error: null,
      },
    ]);

    const edition = await getEditionByIsbn(client, '88-452-9261-4');

    expect(calls.eq).toEqual([['isbn13', '9788845292613']]);
    expect(edition?.contributors).toEqual([
      { name: 'A', role: 'translator' },
      { name: 'B', role: 'editor' },
    ]);
    expect(edition?.work.authors.map((a) => a.name)).toEqual(['Prima', 'Seconda']);
    expect(edition?.work).not.toHaveProperty('work_authors');
  });

  it('returns null when the query fails', async () => {
    const { client } = fakeClient([{ data: null, error: { message: 'network' } }]);
    expect(await getEditionByIsbn(client, '9788845292613')).toBeNull();
  });
});

describe('getWork', () => {
  it('follows a merged work to the one that replaced it', async () => {
    const { client, calls } = fakeClient([
      { data: { ...workRow, id: 'old', merged_into: 'w1', editions: [] }, error: null },
      { data: { ...workRow, editions: [{ id: 'e1', contributors: [] }] }, error: null },
    ]);

    const work = await getWork(client, 'old');

    expect(calls.eq).toEqual([
      ['id', 'old'],
      ['id', 'w1'],
    ]);
    expect(work?.id).toBe('w1');
    expect(work?.editions).toEqual([{ id: 'e1', contributors: [] }]);
  });

  it('gives up on a merge chain that never ends', async () => {
    const loop = { data: { ...workRow, merged_into: 'w1', editions: [] }, error: null };
    const { client } = fakeClient(Array.from({ length: 10 }, () => loop));
    expect(await getWork(client, 'w1')).toBeNull();
  });
});

describe('searchWorks', () => {
  it('skips queries shorter than two characters', async () => {
    const { client } = fakeClient([]);
    expect(await searchWorks(client, ' a ')).toEqual([]);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('calls search_works and attaches ordered authors', async () => {
    const { client, calls } = fakeClient([{ data: [workRow], error: null }]);
    const works = await searchWorks(client, 'rosa', 5);
    expect(calls.rpc).toEqual([['search_works', { query: 'rosa', max_results: 5 }]]);
    expect(works.map((w) => w.authors.map((a) => a.id))).toEqual([['a1', 'a2']]);
  });
});

describe('findWorksByIdentifiers', () => {
  it('asks nothing for no valid identifier', async () => {
    const { client } = fakeClient([]);
    expect(await findWorksByIdentifiers(client, { openLibraryWorkIds: ['nope'], isbns: ['123'] })).toEqual({
      openLibraryWorks: {},
      isbns: {},
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('maps work ids and ISBNs to live works, following a merge', async () => {
    const { client, calls } = fakeClient([
      { data: [{ value: 'OL15W', work: { id: 'w1', merged_into: null } }], error: null },
      { data: [{ isbn13: '9788806031329', work: { id: 'old', merged_into: 'w2' } }], error: null },
    ]);
    const found = await findWorksByIdentifiers(client, {
      openLibraryWorkIds: ['OL15W', 'OL15W'],
      isbns: ['8806031325', '9788806031329'],
    });
    expect(found).toEqual({ openLibraryWorks: { OL15W: 'w1' }, isbns: { '9788806031329': 'w2' } });
    expect(calls.eq).toContainEqual(['source', 'openlibrary']);
    expect(calls.in).toEqual([
      ['value', ['OL15W']],
      ['isbn13', ['9788806031329']],
    ]);
  });

  it('splits long ISBN lists and survives a failed query', async () => {
    const isbns = Array.from({ length: 200 }, (_, i) => {
      const first12 = `979${String(i).padStart(9, '0')}`;
      let sum = 0;
      for (let d = 0; d < 12; d++) sum += Number(first12[d]) * (d % 2 === 0 ? 1 : 3);
      return first12 + String((10 - (sum % 10)) % 10);
    });
    const { client, calls } = fakeClient([{ data: null, error: { code: '500' } }]);
    expect(await findWorksByIdentifiers(client, { openLibraryWorkIds: [], isbns })).toEqual({
      openLibraryWorks: {},
      isbns: {},
    });
    expect(calls.in.map(([, values]) => values.length)).toEqual([150, 50]);
  });
});

describe('findAuthorsByOpenLibraryIds', () => {
  it('asks nothing without a valid author id', async () => {
    const { client } = fakeClient([]);
    expect(await findAuthorsByOpenLibraryIds(client, ['OL15W', 'x'])).toEqual({});
    expect(client.from).not.toHaveBeenCalled();
  });

  it('maps ids to live authors', async () => {
    const { client, calls } = fakeClient([
      {
        data: [
          { value: 'OL77A', author: { id: 'a1', merged_into: null } },
          { value: 'OL78A', author: { id: 'old', merged_into: 'a2' } },
        ],
        error: null,
      },
    ]);
    expect(await findAuthorsByOpenLibraryIds(client, ['OL77A', 'OL78A', 'OL77A'])).toEqual({
      OL77A: 'a1',
      OL78A: 'a2',
    });
    expect(calls.in).toEqual([['value', ['OL77A', 'OL78A']]]);
  });
});

describe('createEdition', () => {
  const entry = { work: { title: 'Opera', authors: [{ name: 'Umberto Eco' }] }, edition: { isbn: '8845292614' } };

  it('does not call the database when validation fails', async () => {
    const { client } = fakeClient([]);
    const result = await createEdition(client, { work: { title: '', authors: [] }, edition: {} });
    expect(result).toEqual({ ok: false, reason: 'invalid', issues: [{ path: 'work.title', code: 'required' }] });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('sends the normalised payload and returns the new ids', async () => {
    const { client, calls } = fakeClient([{ data: { work_id: 'w1', edition_id: 'e1' }, error: null }]);
    expect(await createEdition(client, entry)).toEqual({ ok: true, workId: 'w1', editionId: 'e1' });
    expect(calls.rpc[0]).toEqual([
      'create_edition',
      {
        entry: {
          work: {
            title: 'Opera',
            field_sources: {},
            external_ids: [],
            authors: [{ name: 'Umberto Eco', sort_name: 'Eco, Umberto', alternate_names: [], external_ids: [] }],
          },
          edition: { isbn13: '9788845292613', field_sources: {}, contributors: [], external_ids: [] },
        },
      },
    ]);
  });

  it('maps database errors to reasons', async () => {
    const cases = [
      ['23505', 'duplicate_isbn'],
      ['P0002', 'not_found'],
      ['42501', 'forbidden'],
      ['23514', 'rejected'],
      ['XX000', 'failed'],
    ] as const;
    for (const [code, reason] of cases) {
      const { client } = fakeClient([{ data: null, error: { code, message: 'error' } }]);
      expect(await createEdition(client, entry)).toEqual({ ok: false, reason });
    }
  });

  it('fails when the database answers without ids', async () => {
    const { client } = fakeClient([{ data: { work_id: 'w1' }, error: null }]);
    expect(await createEdition(client, entry)).toEqual({ ok: false, reason: 'failed' });
  });
});
