'use client';

import type { Reading, ReadingResult } from '@libresca/data';
import {
  type ReadingInput,
  type ReadingIssue,
  type ReadingStatus,
  isFinishedStatus,
  localDate,
  openReading,
  readingStatuses,
} from '@libresca/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState, useTransition } from 'react';

import { Button } from '@/components/button';
import { MushroomRating, RatingInput } from '@/components/mushroom-rating';

import { inputClasses } from '../../add/form-field';
import { addOwnReading, removeOwnReading, saveOwnReading } from './actions';
import type { EditionChoice } from './own-copies';

type Failure = Exclude<ReadingResult, { ok: true }>;

interface FormValues {
  status: ReadingStatus;
  startedOn: string;
  finishedOn: string;
  ratingHalf: number | null;
  review: string;
  editionId: string;
}

const card = 'rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4';

/** The user's date, so "today" means the same day for them and for validation. */
const today = () => localDate(new Date());

/** The message key for a refused save; a validation refusal shows its first issue. */
function failureKey(failure: Failure) {
  return failure.reason === 'invalid'
    ? (`errors.${failure.issues[0]?.code ?? 'invalid_option'}` as const)
    : (`errors.${failure.reason}` as const);
}

function toInput(values: FormValues): ReadingInput {
  return { ...values, editionId: values.editionId || null };
}

function valuesOf(reading: Reading): FormValues {
  return {
    status: reading.status,
    startedOn: reading.started_on ?? '',
    finishedOn: reading.finished_on ?? '',
    ratingHalf: reading.rating_half,
    review: reading.review ?? '',
    editionId: reading.edition_id ?? '',
  };
}

/** The fields a reading's status allows: no dates in the Dispensa, end and rating only when done. */
function ReadingForm({
  initial,
  editions,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  editions: EditionChoice[];
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<Failure | null>;
  onCancel: () => void;
}) {
  const t = useTranslations('readings');
  const id = useId();
  const [values, setValues] = useState(initial);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const issue = (path: ReadingIssue['path']) =>
    failure?.reason === 'invalid' ? failure.issues.find((item) => item.path === path) : undefined;
  const issueText = (path: ReadingIssue['path']) => {
    const found = issue(path);
    return found ? t(`errors.${found.code}`) : undefined;
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => setFailure(await onSubmit(values)));
  }

  const done = isFinishedStatus(values.status);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 type-label text-text">{t('fields.status')}</legend>
        <div className="flex flex-wrap gap-x-4">
          {readingStatuses.map((status) => (
            <label key={status} className="flex min-h-[2.75rem] items-center gap-2 type-body text-text">
              <input
                type="radio"
                name={`${id}-status`}
                checked={values.status === status}
                onChange={() => set('status', status)}
                className="size-5 accent-accent"
              />
              {t(`status.${status}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {values.status !== 'want' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-started`} className="type-label text-text">
              {t('fields.startedOn')}
            </label>
            <input
              id={`${id}-started`}
              type="date"
              max={today()}
              value={values.startedOn}
              onChange={(event) => set('startedOn', event.target.value)}
              aria-invalid={Boolean(issue('startedOn')) || undefined}
              className={inputClasses}
            />
            {issueText('startedOn') && <p className="type-small text-danger">{issueText('startedOn')}</p>}
          </div>
          {done && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-finished`} className="type-label text-text">
                {values.status === 'read' ? t('fields.finishedOnRead') : t('fields.finishedOnAbandoned')}
              </label>
              <input
                id={`${id}-finished`}
                type="date"
                max={today()}
                value={values.finishedOn}
                onChange={(event) => set('finishedOn', event.target.value)}
                aria-invalid={Boolean(issue('finishedOn')) || undefined}
                className={inputClasses}
              />
              {issueText('finishedOn') && <p className="type-small text-danger">{issueText('finishedOn')}</p>}
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="flex flex-col gap-1">
          <RatingInput id={`${id}-rating`} value={values.ratingHalf} onChange={(value) => set('ratingHalf', value)} />
          {issueText('ratingHalf') && <p className="type-small text-danger">{issueText('ratingHalf')}</p>}
        </div>
      )}

      {editions.length > 1 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-edition`} className="type-label text-text">
            {t('fields.edition')}
          </label>
          <select
            id={`${id}-edition`}
            value={values.editionId}
            onChange={(event) => set('editionId', event.target.value)}
            className={inputClasses}
          >
            <option value="">{t('fields.editionUnknown')}</option>
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-review`} className="flex flex-wrap items-baseline gap-x-2 type-label text-text">
          {t('fields.review')}
          <span className="type-small text-text-muted">{t('reviewHint')}</span>
        </label>
        <textarea
          id={`${id}-review`}
          rows={3}
          value={values.review}
          onChange={(event) => set('review', event.target.value)}
          aria-invalid={Boolean(issue('review')) || undefined}
          className={inputClasses}
        />
        {issueText('review') && <p className="type-small text-danger">{issueText('review')}</p>}
      </div>

      {failure && failure.reason !== 'invalid' && (
        <p role="alert" className="type-body text-danger">
          {t(`errors.${failure.reason}`)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

function ReadingCard({ workId, reading, editions }: { workId: string; reading: Reading; editions: EditionChoice[] }) {
  const t = useTranslations('readings');
  const format = useFormatter();
  const [mode, setMode] = useState<'view' | 'delete' | { edit: ReadingStatus }>('view');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const failureText = (result: Failure) => t(failureKey(result));
  const day = (value: string) => format.dateTime(new Date(`${value}T12:00:00`), { dateStyle: 'long' });

  /** A one-tap change, such as starting a book from the Dispensa. */
  const quick = (input: ReadingInput) =>
    startBusy(async () => {
      const result = await saveOwnReading(workId, reading.id, input, today());
      setFailure(result.ok ? null : failureText(result));
    });

  if (typeof mode === 'object') {
    return (
      <li className={card}>
        <ReadingForm
          initial={{ ...valuesOf(reading), status: mode.edit }}
          editions={editions}
          submitLabel={t('save')}
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            const result = await saveOwnReading(workId, reading.id, toInput(values), today());
            if (!result.ok) return result;
            setMode('view');
            return null;
          }}
        />
      </li>
    );
  }

  const edition = editions.find((item) => item.id === reading.edition_id);
  const dates = [
    reading.started_on ? t('startedOn', { date: day(reading.started_on) }) : null,
    reading.finished_on
      ? reading.status === 'abandoned'
        ? t('abandonedOn', { date: day(reading.finished_on) })
        : t('finishedOn', { date: day(reading.finished_on) })
      : null,
  ].filter(Boolean);

  return (
    <li className={`${card} flex flex-col gap-2`}>
      <p className="type-title-s text-text">{t(`status.${reading.status}`)}</p>
      {dates.length > 0 && <p className="type-small text-text-muted">{dates.join(' · ')}</p>}
      {edition && <p className="type-small wrap-break-word text-text-muted">{edition.label}</p>}
      {reading.rating_half !== null && <MushroomRating ratingHalf={reading.rating_half} />}
      {reading.review && <p className="type-note whitespace-pre-line text-text">{reading.review}</p>}

      {reading.status === 'want' && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => quick({ status: 'reading' })}>
            {t('actions.start')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode({ edit: 'read' })}>
            {t('actions.read')}
          </Button>
        </div>
      )}
      {reading.status === 'reading' && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => setMode({ edit: 'read' })}>
            {t('actions.finish')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode({ edit: 'abandoned' })}>
            {t('actions.abandon')}
          </Button>
        </div>
      )}
      {failure && (
        <p role="alert" className="type-small text-danger">
          {failure}
        </p>
      )}

      {mode === 'delete' ? (
        <div className="flex flex-col gap-2">
          <p className="type-body text-text">{t('deleteQuestion')}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  if (!(await removeOwnReading(workId, reading.id))) setFailure(t('errors.failed'));
                })
              }
            >
              {t('confirmDelete')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setMode('view')}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4">
          <Button type="button" variant="quiet" onClick={() => setMode({ edit: reading.status })}>
            {t('edit')}
          </Button>
          <Button type="button" variant="quiet" onClick={() => setMode('delete')}>
            {reading.status === 'want' ? t('actions.removeWant') : t('delete')}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * "Le tue letture": every reading of this work, the open one first, separate from the
 * copies (DATA_MODEL.md). A reread is a new reading; one book has at most one open.
 */
export function OwnReadings({
  workId,
  readings,
  editions,
}: {
  workId: string;
  readings: Reading[];
  editions: EditionChoice[];
}) {
  const t = useTranslations('readings');
  const [adding, setAdding] = useState<ReadingStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const failureText = (result: Failure) => t(failureKey(result));
  const open = openReading(readings);
  const readBefore = readings.some((reading) => reading.status === 'read');
  // With a single edition there is nothing to choose: the reading is of that one.
  const defaultEdition = editions.length === 1 ? (editions[0]?.id ?? '') : '';

  const quickAdd = (status: ReadingStatus) =>
    startBusy(async () => {
      const result = await addOwnReading(workId, { status, editionId: defaultEdition || null }, today());
      setFailure(result.ok ? null : failureText(result));
    });

  return (
    <section aria-labelledby="readings-heading" className="flex flex-col gap-3">
      <h2 id="readings-heading" className="type-heading text-text">
        {t('heading')}
      </h2>
      {readings.length === 0 && !adding && <p className="type-body text-text">{t('none')}</p>}

      {adding ? (
        <div className={card}>
          <ReadingForm
            initial={{
              status: adding,
              startedOn: '',
              finishedOn: '',
              ratingHalf: null,
              review: '',
              editionId: defaultEdition,
            }}
            editions={editions}
            submitLabel={t('save')}
            onCancel={() => setAdding(null)}
            onSubmit={async (values) => {
              const result = await addOwnReading(workId, toInput(values), today());
              if (!result.ok) return result;
              setAdding(null);
              return null;
            }}
          />
        </div>
      ) : (
        !open && (
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => quickAdd('want')}>
              {t('actions.want')}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => quickAdd('reading')}>
              {readBefore ? t('actions.reread') : t('actions.reading')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding('read')}>
              {t('actions.read')}
            </Button>
          </div>
        )
      )}
      {failure && (
        <p role="alert" className="type-small text-danger">
          {failure}
        </p>
      )}

      {readings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {readings.map((reading) => (
            <ReadingCard
              key={`${reading.id}-${reading.updated_at}`}
              workId={workId}
              reading={reading}
              editions={editions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
