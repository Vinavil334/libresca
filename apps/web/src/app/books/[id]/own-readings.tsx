'use client';

import type { Reading, ReadingResult } from '@libresca/data';
import {
  type ReadingInput,
  type ReadingIssue,
  type ReadingStatus,
  finishesReading,
  isFinishedStatus,
  localDate,
  openReading,
  readingStatuses,
} from '@libresca/domain';
import { type DateTimeFormatOptions, useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState, useTransition } from 'react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { CloseIcon } from '@/components/icons';
import { MousePlaceholder } from '@/components/mouse-placeholder';
import { MushroomRating, RatingInput } from '@/components/mushroom-rating';
import { Sheet } from '@/components/sheet';
import { StatusPill } from '@/components/status-pill';

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

/** The book the readings belong to, for the sheet and the "Finito!" ticket. */
interface Book {
  workId: string;
  title: string;
  cover?: string | null;
}

/** An open sheet: a new reading, or an existing one; `focusReview` comes from "Scrivi due righe". */
interface SheetState {
  reading?: Reading;
  initial: FormValues;
  number: number;
  focusReview?: boolean;
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

/**
 * The dates of a reading in words. Unknown dates stay unknown: "inizio non segnato",
 * never an estimate (SCHERMATE_TANA.md).
 */
function useReadingDates() {
  const t = useTranslations('readings.dates');
  const format = useFormatter();
  const long: DateTimeFormatOptions = { dateStyle: 'long' };
  const day = (value: string, options: DateTimeFormatOptions = long) =>
    format.dateTime(new Date(`${value}T12:00:00`), options);

  return ({ status, started_on: start, finished_on: end }: Reading): string | null => {
    if (status === 'want') return null;
    if (status === 'reading') return start ? t('from', { start: day(start) }) : t('noStart');
    if (start && end) {
      // "dal 2 al 18 marzo 2024": the start leaves out what it shares with the end.
      const sameYear = start.slice(0, 4) === end.slice(0, 4);
      const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
      const startOptions: DateTimeFormatOptions = sameMonth
        ? { day: 'numeric' }
        : sameYear
          ? { day: 'numeric', month: 'long' }
          : long;
      return t('range', { start: day(start, startOptions), end: day(end) });
    }
    if (end) return `${t(status === 'abandoned' ? 'paused' : 'finished', { end: day(end) })} · ${t('noStart')}`;
    if (start) return `${t('from', { start: day(start) })} · ${t('noEnd')}`;
    return t('none');
  };
}

/**
 * The reading sheet, rising from the bottom: status, optional dates, rating only once
 * the reading is over, notes, and deletion with a confirmation.
 */
function ReadingSheet({
  book,
  state,
  editions,
  onClose,
  onSaved,
}: {
  book: Book;
  state: SheetState;
  editions: EditionChoice[];
  onClose: () => void;
  onSaved: (saved: Reading) => void;
}) {
  const t = useTranslations('readings');
  const id = useId();
  const { reading } = state;
  const [values, setValues] = useState(state.initial);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
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
    startSaving(async () => {
      const input = toInput(values);
      const result = reading
        ? await saveOwnReading(book.workId, reading.id, input, today())
        : await addOwnReading(book.workId, input, today());
      if (result.ok) return onSaved(result.reading);
      setFailure(result);
    });
  }

  const remove = () =>
    startSaving(async () => {
      if (reading && (await removeOwnReading(book.workId, reading.id))) return onClose();
      setDeleteFailed(true);
    });

  const done = isFinishedStatus(values.status);
  const headingId = `${id}-heading`;

  return (
    <Sheet labelledBy={headingId} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex items-start gap-3">
          <BookCover title={book.title} url={book.cover} size="small" />
          <div className="flex min-w-[0] flex-1 flex-col gap-1">
            <h2 id={headingId} className="type-title text-text">
              {t('sheet.title')}
            </h2>
            <p className="type-small wrap-break-word text-text-muted">
              {t('sheet.subtitle', { title: book.title, number: t('numberLower', { number: state.number }) })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sheet.close')}
            className="grid size-[2.75rem] shrink-0 place-items-center rounded-pill text-text"
          >
            <CloseIcon />
          </button>
        </div>

        <fieldset className="flex flex-col">
          <legend className="mb-2 type-label text-text">{t('sheet.status')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {readingStatuses.map((status) => (
              <label
                key={status}
                className="flex min-h-[3rem] items-center gap-2 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-3 type-body text-text has-checked:bg-honey has-checked:text-on-honey"
              >
                <input
                  type="radio"
                  name={`${id}-status`}
                  checked={values.status === status}
                  onChange={() => set('status', status)}
                  className="size-5 shrink-0 accent-accent"
                />
                {t(`choices.${status}`)}
              </label>
            ))}
          </div>
        </fieldset>

        {values.status !== 'want' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-w-[0] flex-col gap-1">
                <label htmlFor={`${id}-started`} className="type-label text-text">
                  {t('sheet.startedOn')}
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
                <div className="flex min-w-[0] flex-col gap-1">
                  <label htmlFor={`${id}-finished`} className="type-label text-text">
                    {values.status === 'read' ? t('sheet.finishedOnRead') : t('sheet.finishedOnAbandoned')}
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
            <p className="type-small text-text-muted">{t('sheet.datesHint')}</p>
          </div>
        )}

        {done && (
          <div className="flex flex-col gap-1">
            <RatingInput
              id={`${id}-rating`}
              label={t('sheet.rating')}
              value={values.ratingHalf}
              onChange={(value) => set('ratingHalf', value)}
            />
            {issueText('ratingHalf') && <p className="type-small text-danger">{issueText('ratingHalf')}</p>}
          </div>
        )}

        {editions.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-edition`} className="type-label text-text">
              {t('sheet.edition')}
            </label>
            <select
              id={`${id}-edition`}
              value={values.editionId}
              onChange={(event) => set('editionId', event.target.value)}
              className={inputClasses}
            >
              <option value="">{t('sheet.editionUnknown')}</option>
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
            {t('sheet.review')}
            <span className="type-small text-text-muted">{t('sheet.reviewHint')}</span>
          </label>
          <textarea
            id={`${id}-review`}
            rows={3}
            value={values.review}
            onChange={(event) => set('review', event.target.value)}
            aria-invalid={Boolean(issue('review')) || undefined}
            data-autofocus={state.focusReview || undefined}
            className={inputClasses}
          />
          {issueText('review') && <p className="type-small text-danger">{issueText('review')}</p>}
        </div>

        {failure && failure.reason !== 'invalid' && (
          <p role="alert" className="type-body text-danger">
            {t(`errors.${failure.reason}`)}
          </p>
        )}
        <Button type="submit" disabled={saving} className="self-stretch">
          {saving ? t('sheet.saving') : t('sheet.save')}
        </Button>

        {reading &&
          (confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="type-body text-text">{t('sheet.deleteQuestion')}</p>
              {deleteFailed && (
                <p role="alert" className="type-small text-danger">
                  {t('errors.failed')}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" disabled={saving} onClick={remove}>
                  {t('sheet.confirmDelete')}
                </Button>
                <Button type="button" variant="quiet" onClick={() => setConfirmDelete(false)}>
                  {t('sheet.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} className="self-center">
              {reading.status === 'want' ? t('sheet.deleteWant') : t('sheet.delete')}
            </Button>
          ))}
      </form>
    </Sheet>
  );
}

/**
 * "Finito!": the moment a book is finished, on the ticket with the placeholder mouse.
 * It asks for a rating and nothing else: no counts, no goals, no automatic dates.
 */
function FinishedTicket({
  book,
  reading,
  onClose,
  onWrite,
}: {
  book: Book;
  reading: Reading;
  onClose: () => void;
  onWrite: (ratingHalf: number | null) => void;
}) {
  const t = useTranslations('readings');
  const id = useId();
  const [rating, setRating] = useState(reading.rating_half);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () => {
    if (rating === reading.rating_half) return onClose();
    startSaving(async () => {
      const input = { ...toInput(valuesOf(reading)), ratingHalf: rating };
      const result = await saveOwnReading(book.workId, reading.id, input, today());
      if (result.ok) return onClose();
      setFailure(t(failureKey(result)));
    });
  };

  return (
    <Sheet variant="ticket" labelledBy={`${id}-heading`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <MousePlaceholder className="w-[8rem]" />
          <h2 id={`${id}-heading`} className="type-display-l text-text">
            {t('finished.title')}
          </h2>
          <p className="type-body wrap-break-word text-text">{t('finished.text', { title: book.title })}</p>
        </div>
        <RatingInput id={`${id}-rating`} label={t('finished.rating')} value={rating} onChange={setRating} />
        {failure && (
          <p role="alert" className="type-small text-danger">
            {failure}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" disabled={saving} onClick={save}>
            {t('finished.save')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onWrite(rating)}>
            {t('finished.write')}
          </Button>
          <Button type="button" variant="quiet" onClick={onClose}>
            {t('finished.later')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * "Le tue letture": every reading of this work, newest first, separate from the copies
 * (DATA_MODEL.md). A reread is a new reading; one book has at most one open. Without any
 * reading the block asks "L'hai letto?".
 */
export function OwnReadings({
  workId,
  title,
  cover,
  readings,
  editions,
}: {
  workId: string;
  title: string;
  cover?: string | null;
  readings: Reading[];
  editions: EditionChoice[];
}) {
  const t = useTranslations('readings');
  const datesOf = useReadingDates();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // The id, not the reading: the list refreshes after each save.
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const book: Book = { workId, title, cover };
  const open = openReading(readings);
  const finished = readings.find((reading) => reading.id === finishedId);
  // Readings come newest first, so the oldest is the first reading.
  const numberOf = (reading: Reading) => readings.length - readings.indexOf(reading);
  // With a single edition there is nothing to choose: the reading is of that one.
  const defaultEdition = editions.length === 1 ? (editions[0]?.id ?? '') : '';
  const fresh = (status: ReadingStatus): FormValues => ({
    status,
    startedOn: '',
    finishedOn: '',
    ratingHalf: null,
    review: '',
    editionId: defaultEdition,
  });

  const run = (action: () => Promise<ReadingResult>, then?: (saved: Reading) => void) =>
    startBusy(async () => {
      const result = await action();
      if (!result.ok) return setFailure(t(failureKey(result)));
      setFailure(null);
      then?.(result.reading);
    });
  const add = (status: ReadingStatus) => run(() => addOwnReading(workId, toInput(fresh(status)), today()));
  /** A one-tap change that keeps everything else of the reading, such as its notes. */
  const change = (reading: Reading, status: ReadingStatus) =>
    run(
      () => saveOwnReading(workId, reading.id, { ...toInput(valuesOf(reading)), status }, today()),
      (saved) => {
        if (finishesReading(reading.status, saved.status)) setFinishedId(saved.id);
      },
    );

  return (
    <section aria-labelledby="readings-heading" className="flex flex-col gap-3">
      <h2 id="readings-heading" className="type-heading text-text">
        {readings.length > 0 ? t('heading') : t('askHeading')}
      </h2>
      {readings.length === 0 && <p className="type-body text-text-muted">{t('askHint')}</p>}

      {!open && (
        <div className="flex flex-wrap gap-3">
          {readings.length === 0 ? (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => add('want')}>
                {t('actions.want')}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => add('reading')}>
                {t('actions.reading')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSheet({ initial: fresh('read'), number: 1 })}>
                {t('actions.readBefore')}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => add('reading')}>
                {t('actions.reread')}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => add('want')}>
                {t('actions.wantAgain')}
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setSheet({ initial: fresh('read'), number: readings.length + 1 })}
              >
                {t('actions.readAgain')}
              </Button>
            </>
          )}
        </div>
      )}
      {failure && (
        <p role="alert" className="type-small text-danger">
          {failure}
        </p>
      )}

      {readings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {readings.map((reading) => {
            const dates = datesOf(reading);
            const edition = editions.find((item) => item.id === reading.edition_id);
            const number = numberOf(reading);
            return (
              <li key={reading.id} className={`${card} flex flex-col gap-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="type-title-s text-text">{t('number', { number })}</p>
                  <StatusPill status={reading.status} />
                </div>
                {dates && <p className="type-small text-text-muted">{dates}</p>}
                {edition && <p className="type-small wrap-break-word text-text-muted">{edition.label}</p>}
                {reading.rating_half !== null && <MushroomRating ratingHalf={reading.rating_half} />}

                <div className="flex flex-wrap items-center gap-3">
                  {reading.status === 'want' && (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => change(reading, 'reading')}
                      >
                        {t('actions.start')}
                      </Button>
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => change(reading, 'read')}>
                        {t('actions.read')}
                      </Button>
                    </>
                  )}
                  {reading.status === 'reading' && (
                    <>
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => change(reading, 'read')}>
                        {t('actions.finish')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => change(reading, 'abandoned')}
                      >
                        {t('actions.pause')}
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => setSheet({ reading, initial: valuesOf(reading), number })}
                  >
                    {t('actions.edit')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sheet && (
        <ReadingSheet
          book={book}
          state={sheet}
          editions={editions}
          onClose={() => setSheet(null)}
          onSaved={(saved) => {
            setSheet(null);
            if (finishesReading(sheet.reading?.status ?? null, saved.status)) setFinishedId(saved.id);
          }}
        />
      )}
      {finished && (
        <FinishedTicket
          book={book}
          reading={finished}
          onClose={() => setFinishedId(null)}
          onWrite={(ratingHalf) => {
            setFinishedId(null);
            setSheet({
              reading: finished,
              initial: { ...valuesOf(finished), ratingHalf },
              number: numberOf(finished),
              focusReview: true,
            });
          }}
        />
      )}
    </section>
  );
}
