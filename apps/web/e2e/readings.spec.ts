import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('readings', () => {
  let ada: TestAccount;
  let carla: TestAccount;
  let workId: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    carla = await createAccount('active');
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title: `Il bosco delle letture ${token()}`, authors: [{ name: 'Ada Muskio' }] },
        edition: { publisher: 'Edizioni Sottobosco', published_year: 2019 },
      },
    });
    expect(error).toBeNull();
    workId = (data as { work_id: string }).work_id;
  });
  test.afterEach(async () => {
    await deleteWork(workId);
    await deleteAccount(ada);
    await deleteAccount(carla);
  });

  test('from the Dispensa to finished with a rating, then a reread', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText("Non l'hai ancora letto, e non è in Dispensa.")).toBeVisible();

    await readings.getByRole('button', { name: 'Mettilo in Dispensa' }).click();
    await expect(readings.getByText('In Dispensa · da leggere')).toBeVisible();

    await readings.getByRole('button', { name: 'Comincio a leggerlo' }).click();
    await expect(readings.getByText('In lettura', { exact: true })).toBeVisible();

    await readings.getByRole('button', { name: "L'ho finito" }).click();
    await expect(readings.getByLabel('Letto', { exact: true })).toBeChecked();
    await readings.getByLabel("Quando l'hai cominciato").fill('2024-03-01');
    await readings.getByLabel("Quando l'hai finito").fill('2024-03-20');
    await readings.getByRole('slider', { name: 'Voto a funghetti' }).fill('9');
    await expect(readings.getByRole('slider', { name: 'Voto a funghetti' })).toHaveAttribute(
      'aria-valuetext',
      '4,5 funghetti',
    );
    await readings.getByLabel('Note').fill('Una topina indimenticabile');
    await readings.getByRole('button', { name: 'Salva' }).click();

    await expect(readings.getByText('Letto', { exact: true })).toBeVisible();
    await expect(readings.getByText('Cominciato il 1 marzo 2024 · Finito il 20 marzo 2024')).toBeVisible();
    await expect(readings.getByRole('img', { name: '4,5 funghetti' })).toBeVisible();
    await expect(readings.getByText('Una topina indimenticabile')).toBeVisible();

    // A reread is a new reading; the first one stays with its date and rating.
    await readings.getByRole('button', { name: 'Lo rileggo' }).click();
    await expect(readings.getByText('In lettura', { exact: true })).toBeVisible();
    await expect(readings.getByRole('listitem')).toHaveCount(2);
    await page.reload();
    await expect(readings.getByRole('listitem').first()).toContainText('In lettura');
    await expect(readings.getByRole('listitem').nth(1)).toContainText('Finito il 20 marzo 2024');
  });

  test('an end before the start is refused gently', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await readings.getByRole('button', { name: "L'ho letto" }).click();
    await readings.getByLabel("Quando l'hai cominciato").fill('2024-03-02');
    await readings.getByLabel("Quando l'hai finito").fill('2024-03-01');
    await readings.getByRole('button', { name: 'Salva' }).click();
    await expect(readings.getByText("La fine viene prima dell'inizio: controlla le date.")).toBeVisible();
  });

  test("another account never sees someone else's readings", async ({ page, context, baseURL }) => {
    const { client } = await signInClient(ada);
    const { error } = await client
      .from('readings')
      .insert({ work_id: workId, status: 'read', rating_half: 10, review: 'Il giudizio di Ada' });
    expect(error).toBeNull();

    await signIn(context, carla, baseURL!);
    await page.goto(`/books/${workId}`);
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText("Non l'hai ancora letto, e non è in Dispensa.")).toBeVisible();
    await expect(page.getByText('Il giudizio di Ada')).toHaveCount(0);
  });
});
