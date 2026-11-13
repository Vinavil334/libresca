import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

// The app runs with METADATA_SOURCES=off: no source knows any book, so the import uses
// the catalog and the export itself. Matching against the sources is covered by unit tests.

/** A random valid ISBN-13, so parallel runs never collide on the unique index. */
function randomIsbn13(): string {
  const first12 = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return first12 + String((10 - (sum % 10)) % 10);
}

const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;
const goodreadsId = () => String(Math.floor(Math.random() * 1e9));

const header =
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';

/** An invented export, quoted like the real one. */
function exportCsv(rows: string[][]): string {
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [header, ...rows.map((row) => row.map(quote).join(','))].join('\n') + '\n';
}

test.describe('importing from Goodreads', () => {
  // An import runs several steps against the database: more time than a page.
  test.describe.configure({ timeout: 120_000 });
  let ada: TestAccount;
  const workIds: string[] = [];

  test.beforeEach(async () => {
    ada = await createAccount('active');
  });
  test.afterEach(async () => {
    const { client } = await signInClient(ada);
    const { data } = await client.from('import_rows').select('work_id');
    for (const row of data ?? []) if (row.work_id) workIds.push(row.work_id);
    for (const id of [...new Set(workIds.splice(0))]) await deleteWork(id);
    await deleteAccount(ada);
  });

  test('previews the export, imports it into the Tana, and never twice', async ({ page, context, baseURL }) => {
    const word = token();
    const isbnNew = randomIsbn13();
    const isbnKnown = randomIsbn13();
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title: `Il bosco già noto ${word}`, authors: [{ name: 'Carla Ghianda' }] },
        edition: { isbn13: isbnKnown },
      },
    });
    expect(error).toBeNull();
    workIds.push((data as { work_id: string }).work_id);

    const csv = exportCsv([
      // Read twice, rated, a date, a shelf.
      [
        goodreadsId(),
        `La topina e la luna ${word} (Sottobosco, #1)`,
        'Ada Muskio',
        'Muskio, Ada',
        '',
        '',
        `="${isbnNew}"`,
        '4.5',
        'Edizioni Sottobosco',
        'Paperback',
        '212',
        '2019',
        '1957',
        '2024/03/18',
        '2024/01/02',
        'comodino, read',
        'comodino (#1), read (#3)',
        'read',
        'Bellissimo.<br/>Da rileggere.',
        '',
        '',
        '2',
        '0',
      ],
      // In the Dispensa, no ISBN.
      [
        goodreadsId(),
        `La radura senza codice ${word}`,
        'Bruno Felce',
        'Felce, Bruno',
        '',
        '=""',
        '=""',
        '0',
        '',
        '',
        '',
        '',
        '',
        '',
        '2025/05/01',
        'to-read',
        'to-read (#1)',
        'to-read',
        '',
        '',
        '',
        '0',
        '0',
      ],
      // Read, already in the catalog by ISBN.
      [
        goodreadsId(),
        `Il bosco già noto ${word}`,
        'Carla Ghianda',
        'Ghianda, Carla',
        '',
        '',
        `="${isbnKnown}"`,
        '5',
        '',
        '',
        '',
        '',
        '',
        '',
        '2023/02/02',
        'read',
        'read (#1)',
        'read',
        '',
        '',
        '',
        '1',
        '0',
      ],
    ]);

    await signIn(context, ada, baseURL!);
    await page.goto('/');
    await page.getByRole('link', { name: 'Importa da Goodreads' }).click();
    await expect(page).toHaveURL(/\/import$/);
    await page.getByLabel('File CSV di Goodreads').setInputFiles({
      name: 'goodreads_library_export.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    const summary = page.getByRole('region', { name: 'Cosa arriva nella Tana' });
    await expect(summary.getByText("3 libri nell'export")).toBeVisible();
    await expect(summary.getByText('2 letti · 0 in lettura · 1 in Dispensa · 0 messi da parte')).toBeVisible();
    await expect(summary.getByText(/^2 copie nella Tana/)).toBeVisible();
    await expect(summary.getByText("1 riletto: la data va solo all'ultima lettura.")).toBeVisible();
    await summary.getByRole('button', { name: 'Importa 3 libri' }).click();

    await expect(page.getByRole('heading', { name: 'Fatto!' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('3 libri nuovi sono nella tua Tana.')).toBeVisible();

    await page.getByRole('link', { name: 'Vai alla Tana' }).click();
    await expect(page.getByText('la tua libreria · 3 libri')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Cerca nella tua Tana' }).fill('topina');
    const all = page.getByRole('region', { name: 'Tutta la Tana' });
    await page.getByRole('button', { name: 'Elenco' }).click();
    const topina = all.getByRole('listitem').filter({ hasText: 'La topina e la luna' });
    await expect(topina).toContainText('Letto 2 volte');
    // A decimal rating keeps its quarters.
    await expect(topina.getByRole('img', { name: '4,5 funghetti' })).toBeVisible();

    await topina.getByRole('link').click();
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText('finita il 18 marzo 2024 · inizio non segnato')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Le tue note' })).toContainText('Da rileggere.');
    await expect(
      page.getByRole('region', { name: 'Sui tuoi scaffali' }).getByRole('button', { name: 'comodino' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: "Ce l'hai" })).toContainText('Si può prestare');

    // An earlier import truncated 4.5 to 4: the same file again repairs that and adds nothing.
    const { error: truncate } = await client
      .from('readings')
      .update({ rating_quarter: 16 })
      .eq('finished_on', '2024-03-18')
      .eq('rating_quarter', 18);
    expect(truncate).toBeNull();
    await page.goto('/import');
    await page.getByRole('button', { name: 'Importa un altro file' }).click();
    await page.getByLabel('File CSV di Goodreads').setInputFiles({
      name: 'goodreads_library_export.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: 'Importa 3 libri' }).click();
    await expect(page.getByRole('heading', { name: 'Fatto!' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('3 erano già nella Tana: non li abbiamo toccati.')).toBeVisible();
    await expect(page.getByText('A 1 di questi abbiamo ridato i quarti di funghetto del voto.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('la tua libreria · 3 libri')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Cerca nella tua Tana' }).fill('topina');
    await page.getByRole('button', { name: 'Elenco' }).click();
    await expect(all.getByRole('img', { name: '4,5 funghetti' })).toBeVisible();
  });

  test('a doubtful book waits for the user to pick it', async ({ page, context, baseURL }) => {
    const word = token();
    const { client } = await signInClient(ada);
    const { data: job } = await client
      .from('import_jobs')
      .insert({ source: 'goodreads', status: 'finished' })
      .select()
      .single();
    if (!job) throw new Error('no job');
    const book = {
      line: 2,
      goodreadsId: goodreadsId(),
      title: `Il fungo incerto ${word}`,
      searchTitle: `Il fungo incerto ${word}`,
      author: 'Dora Spora',
      isbn13: null,
      publisher: null,
      pageCount: null,
      publishedYear: null,
      originalYear: null,
      status: 'read',
      exclusiveShelf: 'read',
      ratingQuarter: 12,
      finishedOn: null,
      readCount: 1,
      copies: 1,
      shelves: [],
      review: null,
    };
    const candidate = {
      key: '/works/OL1W',
      title: `Il fungo incerto, edizione illustrata ${word}`,
      authors: ['Dora Spora'],
      year: 2001,
      entry: {
        work: { title: `Il fungo incerto, edizione illustrata ${word}`, authors: [{ name: 'Dora Spora' }] },
        edition: {},
      },
    };
    const { error } = await client.from('import_rows').insert({
      job_id: job.id,
      line: 2,
      source_key: book.goodreadsId,
      raw: book,
      status: 'review',
      candidates: [candidate],
    });
    expect(error).toBeNull();

    await signIn(context, ada, baseURL!);
    await page.goto('/import');
    const review = page.getByRole('region', { name: 'Da controllare' });
    await expect(review.getByText(`Il fungo incerto ${word}`, { exact: true })).toBeVisible();
    await review.getByRole('button', { name: `È questo: Il fungo incerto, edizione illustrata ${word}` }).click();
    await expect(page.getByRole('region', { name: 'Da controllare' })).toHaveCount(0);

    await page.goto('/');
    await expect(page.getByRole('link', { name: new RegExp(`edizione illustrata ${word}`) })).toBeVisible();
  });
});
