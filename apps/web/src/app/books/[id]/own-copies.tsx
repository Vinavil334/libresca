'use client';

import type { CopyResult, CopyWithEdition } from '@libresca/data';
import { type CopyIssue, localDate } from '@libresca/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState, useTransition } from 'react';

import { Button } from '@/components/button';

import { inputClasses } from '../../add/form-field';
import { addOwnCopy, removeOwnCopy, saveOwnCopy } from './actions';

export interface EditionChoice {
  id: string;
  label: string;
}

type Failure = Exclude<CopyResult, { ok: true }>;

const card = 'rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4';

/** The user's date, so "today" means the same day for them and for validation. */
const today = () => localDate(new Date());

/** The copy fields the owner edits; visibility arrives with friends in F2.2. */
function CopyForm({
  initial,
  submitLabel,
  editions,
  onSubmit,
  onCancel,
}: {
  initial: { isLendable: boolean; acquiredOn: string; notes: string };
  submitLabel: string;
  editions?: EditionChoice[];
  onSubmit: (values: {
    editionId?: string;
    isLendable: boolean;
    acquiredOn: string;
    notes: string;
  }) => Promise<Failure | null>;
  onCancel: () => void;
}) {
  const t = useTranslations('copies');
  const id = useId();
  const [values, setValues] = useState(initial);
  const [editionId, setEditionId] = useState(editions?.[0]?.id);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saving, startSaving] = useTransition();
  const issue = (path: CopyIssue['path']) =>
    failure?.reason === 'invalid' ? failure.issues.find((item) => item.path === path) : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => setFailure(await onSubmit({ ...values, editionId })));
  }

  const dateIssue = issue('acquiredOn');
  const notesIssue = issue('notes');

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {editions && editions.length > 1 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 type-label text-text">{t('chooseEdition')}</legend>
          {editions.map((edition) => (
            <label key={edition.id} className="flex min-h-[2.75rem] items-center gap-3 type-body text-text">
              <input
                type="radio"
                name={`${id}-edition`}
                checked={editionId === edition.id}
                onChange={() => setEditionId(edition.id)}
                className="size-5 accent-accent"
              />
              {edition.label}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex min-h-[2.75rem] items-center gap-3 type-body text-text">
        <input
          type="checkbox"
          checked={values.isLendable}
          onChange={(event) => setValues((current) => ({ ...current, isLendable: event.target.checked }))}
          className="size-5 accent-accent"
        />
        {t('fields.lendable')}
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-acquired`} className="type-label text-text">
          {t('fields.acquiredOn')}
        </label>
        <input
          id={`${id}-acquired`}
          type="date"
          max={today()}
          value={values.acquiredOn}
          onChange={(event) => setValues((current) => ({ ...current, acquiredOn: event.target.value }))}
          aria-invalid={Boolean(dateIssue) || undefined}
          className={inputClasses}
        />
        {dateIssue && <p className="type-small text-danger">{t(`errors.${dateIssue.code}`)}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-notes`} className="flex flex-wrap items-baseline gap-x-2 type-label text-text">
          {t('fields.notes')}
          <span className="type-small text-text-muted">{t('notesHint')}</span>
        </label>
        <textarea
          id={`${id}-notes`}
          rows={3}
          value={values.notes}
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          aria-invalid={Boolean(notesIssue) || undefined}
          className={inputClasses}
        />
        {notesIssue && <p className="type-small text-danger">{t(`errors.${notesIssue.code}`)}</p>}
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

function CopyCard({ workId, copy, editionLabel }: { workId: string; copy: CopyWithEdition; editionLabel: string }) {
  const t = useTranslations('copies');
  const format = useFormatter();
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [failed, setFailed] = useState(false);
  const [removing, startRemoving] = useTransition();

  if (mode === 'edit') {
    return (
      <li className={card}>
        <p className="mb-3 type-title-s wrap-break-word text-text">{editionLabel}</p>
        <CopyForm
          initial={{ isLendable: copy.is_lendable, acquiredOn: copy.acquired_on ?? '', notes: copy.notes ?? '' }}
          submitLabel={t('save')}
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            const result = await saveOwnCopy(workId, copy.id, values, today());
            if (!result.ok) return result;
            setMode('view');
            return null;
          }}
        />
      </li>
    );
  }

  return (
    <li className={`${card} flex flex-col gap-2`}>
      <p className="type-title-s wrap-break-word text-text">{editionLabel}</p>
      <p className="type-small text-text-muted">
        {[
          copy.is_lendable ? t('lendable') : t('notLendable'),
          copy.acquired_on
            ? t('acquiredOn', {
                date: format.dateTime(new Date(`${copy.acquired_on}T12:00:00`), { dateStyle: 'long' }),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {copy.notes && <p className="type-note whitespace-pre-line text-text">{copy.notes}</p>}
      {mode === 'delete' ? (
        <div className="flex flex-col gap-2">
          <p className="type-body text-text">{t('deleteQuestion')}</p>
          {failed && (
            <p role="alert" className="type-small text-danger">
              {t('errors.failed')}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={removing}
              onClick={() =>
                startRemoving(async () => {
                  if (!(await removeOwnCopy(workId, copy.id))) setFailed(true);
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
          <Button type="button" variant="quiet" onClick={() => setMode('edit')}>
            {t('edit')}
          </Button>
          <Button type="button" variant="quiet" onClick={() => setMode('delete')}>
            {t('delete')}
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * "Ce l'hai": the user's copies of this work, separate from readings (DATA_MODEL.md).
 * Adding asks which edition when the work has more than one.
 */
export function OwnCopies({
  workId,
  copies,
  editions,
}: {
  workId: string;
  copies: CopyWithEdition[];
  editions: EditionChoice[];
}) {
  const t = useTranslations('copies');
  const [adding, setAdding] = useState(false);
  const labelOf = (editionId: string) => editions.find((edition) => edition.id === editionId)?.label ?? '';

  return (
    <section aria-labelledby="copies-heading" className="flex flex-col gap-3">
      <h2 id="copies-heading" className="type-heading text-text">
        {copies.length > 0 ? t('heading') : t('askHeading')}
      </h2>
      {copies.length === 0 && !adding && (
        <p className="type-body text-text">
          {t('none')} {editions.length > 1 && t('chooseLater')}
        </p>
      )}
      {copies.length > 0 && (
        <ul className="flex flex-col gap-3">
          {copies.map((copy) => (
            <CopyCard key={copy.id} workId={workId} copy={copy} editionLabel={labelOf(copy.edition_id)} />
          ))}
        </ul>
      )}
      {adding ? (
        <div className={card}>
          <CopyForm
            initial={{ isLendable: true, acquiredOn: '', notes: '' }}
            submitLabel={t('add')}
            editions={editions}
            onCancel={() => setAdding(false)}
            onSubmit={async ({ editionId, ...values }) => {
              if (!editionId) return { ok: false, reason: 'not_found' };
              const result = await addOwnCopy(workId, editionId, values, today());
              if (!result.ok) return result;
              setAdding(false);
              return null;
            }}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant={copies.length === 0 ? 'primary' : 'secondary'}
          onClick={() => setAdding(true)}
          className="self-start"
        >
          {copies.length === 0 ? t('own') : t('ownAnother')}
        </Button>
      )}
    </section>
  );
}
