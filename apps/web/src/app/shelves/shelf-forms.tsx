'use client';

import type { ShelfResult } from '@libresca/data';
import { shelfNameMaxLength } from '@libresca/domain';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState, useTransition } from 'react';

import { Button } from '@/components/button';
import { CloseIcon } from '@/components/icons';
import { Sheet } from '@/components/sheet';

import { inputClasses } from '../add/form-field';
import { createOwnShelf, deleteOwnShelf, renameOwnShelf } from './actions';

type Failure = Exclude<ShelfResult, { ok: true }>;

function useFailureText() {
  const t = useTranslations('shelves.errors');
  return (failure: Failure) => t(failure.reason === 'invalid' ? failure.issue : failure.reason);
}

/** The shelf name field with its error, shared by "Nuovo scaffale" and "Modifica lo scaffale". */
function NameField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const t = useTranslations('shelves');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="type-label text-text">
        {t('nameLabel')}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('namePlaceholder')}
        maxLength={shelfNameMaxLength + 20}
        autoComplete="off"
        data-autofocus
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClasses}
      />
      {error && (
        <p id={`${id}-error`} className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** "Nuovo scaffale": a small sheet with the name; the new shelf opens right away. */
export function NewShelf() {
  const t = useTranslations('shelves');
  const failureText = useFailureText();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saving, startSaving] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await createOwnShelf(name);
      if (!result.ok) return setFailure(result);
      router.push(`/shelves/${result.shelf.id}`);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="self-start">
        {t('new')}
      </Button>
      {open && (
        <Sheet labelledBy={`${id}-heading`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <div className="flex items-start justify-between gap-3">
              <h2 id={`${id}-heading`} className="type-title text-text">
                {t('new')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('cancel')}
                className="grid size-[2.75rem] shrink-0 place-items-center rounded-pill text-text"
              >
                <CloseIcon />
              </button>
            </div>
            <NameField
              id={`${id}-name`}
              value={name}
              onChange={setName}
              error={failure ? failureText(failure) : undefined}
            />
            <Button type="submit" disabled={saving} className="self-stretch">
              {t('create')}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}

/** "Modifica lo scaffale": rename it, or delete it after a confirmation; the books stay in the Tana. */
export function EditShelf({ shelfId, name: currentName }: { shelfId: string; name: string }) {
  const t = useTranslations('shelves');
  const failureText = useFailureText();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, startSaving] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await renameOwnShelf(shelfId, name);
      if (!result.ok) return setFailure(failureText(result));
      setOpen(false);
    });
  }

  const remove = () =>
    startSaving(async () => {
      if (await deleteOwnShelf(shelfId)) return router.push('/shelves');
      setFailure(t('errors.failed'));
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setName(currentName);
          setFailure(null);
          setConfirmDelete(false);
          setOpen(true);
        }}
        className="inline-flex min-h-[2.75rem] items-center type-label underline underline-offset-4"
      >
        {t('edit')}
      </button>
      {open && (
        <Sheet labelledBy={`${id}-heading`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <div className="flex items-start justify-between gap-3">
              <h2 id={`${id}-heading`} className="type-title text-text">
                {t('edit')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('cancel')}
                className="grid size-[2.75rem] shrink-0 place-items-center rounded-pill text-text"
              >
                <CloseIcon />
              </button>
            </div>
            <NameField id={`${id}-name`} value={name} onChange={setName} error={failure ?? undefined} />
            <Button type="submit" disabled={saving} className="self-stretch">
              {t('rename')}
            </Button>
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="type-body text-text">{t('deleteQuestion')}</p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" disabled={saving} onClick={remove}>
                    {t('confirmDelete')}
                  </Button>
                  <Button type="button" variant="quiet" onClick={() => setConfirmDelete(false)}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)} className="self-center">
                {t('delete')}
              </Button>
            )}
          </form>
        </Sheet>
      )}
    </>
  );
}
