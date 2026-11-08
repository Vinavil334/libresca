'use client';

import type { CreateEditionResult } from '@libresca/data';
import { type CatalogIssue, editionFormats } from '@libresca/domain';
import {
  type EditionProposal,
  type ProposalEdits,
  type Sourced,
  type ValueSource,
  editsFromProposal,
} from '@libresca/metadata/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState, useTransition } from 'react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { BackIcon, CloseIcon, PlusIcon } from '@/components/icons';

import { addEdition } from './actions';

/** A catalog work this edition belongs to (`identifier`) or may belong to (`title_author`). */
export interface WorkMatch {
  workId: string;
  title?: string;
  basis: 'identifier' | 'title_author';
}

type Field = 'title' | 'authors' | 'publisher' | 'publishedYear' | 'pageCount' | 'isbn' | 'format';

/** Which form field a validation issue belongs to; anything else is shown above the button. */
function fieldOf(path: string): Field | null {
  if (path === 'work.title' || path === 'edition.title') return 'title';
  if (path.startsWith('work.authors')) return 'authors';
  const edition: Record<string, Field> = {
    'edition.publisher': 'publisher',
    'edition.publishedYear': 'publishedYear',
    'edition.pageCount': 'pageCount',
    'edition.isbn': 'isbn',
    'edition.format': 'format',
  };
  return edition[path] ?? null;
}

const knownIssues = [
  'required',
  'too_long',
  'invalid_year',
  'invalid_page_count',
  'invalid_isbn',
  'duplicate',
] as const;

const input =
  'min-h-[3rem] w-full rounded-card border-(length:--border-ink) border-border bg-surface-raised px-4 py-2 type-body text-text aria-[invalid=true]:border-danger';

function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 type-label text-text">
        {label}
        {hint && <span className="type-small text-text-muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ConfirmEdition({
  proposal,
  match,
  notice,
  onBack,
}: {
  proposal: EditionProposal;
  match?: WorkMatch;
  notice?: 'notFound' | 'manual';
  onBack: () => void;
}) {
  const t = useTranslations('add.confirm');
  const tCover = useTranslations('add.cover');
  const router = useRouter();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [initial] = useState(() => editsFromProposal(proposal));
  const [edits, setEdits] = useState<Omit<ProposalEdits, 'authors'>>(initial);
  const [authors, setAuthors] = useState(() =>
    (initial.authors.length > 0 ? initial.authors : ['']).map((name, key) => ({ key, name })),
  );
  // `identifier`: certainly the same work. `title_author`: the user answers.
  const [sameWork, setSameWork] = useState<boolean | null>(match?.basis === 'identifier' ? true : null);
  const [askAnswer, setAskAnswer] = useState(false);
  const [failure, setFailure] = useState<Exclude<CreateEditionResult, { ok: true }> | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);

  const attach = Boolean(match && sameWork);
  const issues: CatalogIssue[] = failure?.reason === 'invalid' ? failure.issues : [];
  const issueText = (field: Field): string | undefined => {
    const issue = issues.find((candidate) => fieldOf(candidate.path) === field);
    if (!issue) return undefined;
    const code = knownIssues.find((known) => known === issue.code);
    return t(`issues.${code ?? 'other'}`);
  };

  const sourceName = (source: ValueSource) => t(`sources.${source}`);
  /** "da SBN" next to a label, while the value is still the proposed one. */
  const hint = (field: keyof Omit<ProposalEdits, 'authors'>, sourced: Sourced<unknown> | undefined) =>
    sourced && edits[field] === initial[field] ? t('source', { source: sourceName(sourced.source) }) : undefined;

  const set = (field: keyof Omit<ProposalEdits, 'authors'>) => (value: string) =>
    setEdits((current) => ({ ...current, [field]: value }));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (match && sameWork === null) return setAskAnswer(true);
    startSaving(async () => {
      const result = await addEdition({
        proposal,
        edits: { ...edits, authors: authors.map((author) => author.name) },
        workId: attach ? match?.workId : undefined,
      });
      if (result.ok) return router.push(`/books/${result.workId}?added=1`);
      setFailure(result);
    });
  }

  const describedBy = (field: Field) => (issueText(field) ? `${id}-${field}-error` : undefined);
  const matchTitle = match?.title;

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link"
        >
          <BackIcon />
          {t('back')}
        </button>
        <h2 ref={heading} tabIndex={-1} className="type-display-l text-text">
          {t('title')}
        </h2>
        <p className="type-body text-text">
          {notice === 'notFound' ? t('notFound') : notice === 'manual' ? t('manualIntro') : t('intro')}
        </p>
      </div>

      {match && (
        <div className="flex flex-col gap-3 rounded-card border-(length:--border-ink) border-border bg-ticket p-4">
          {match.basis === 'identifier' ? (
            <p className="type-body text-text">
              {matchTitle ? t('sameWork', { title: matchTitle }) : t('sameWorkUnknown')}
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="type-body text-text">
                {matchTitle ? t('maybeSameWork', { title: matchTitle }) : t('maybeSameWorkUnknown')}
              </legend>
              {[true, false].map((value) => (
                <label key={String(value)} className="flex min-h-[2.75rem] items-center gap-3 type-body text-text">
                  <input
                    type="radio"
                    name="same-work"
                    checked={sameWork === value}
                    onChange={() => {
                      setSameWork(value);
                      setAskAnswer(false);
                    }}
                    className="size-5 accent-accent"
                  />
                  {value ? t('sameWorkYes') : t('sameWorkNo')}
                </label>
              ))}
              {askAnswer && (
                <p role="alert" className="type-small text-danger">
                  {t('answerSameWork')}
                </p>
              )}
            </fieldset>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <BookCover
          title={edits.title || matchTitle || ''}
          url={proposal.cover?.url}
          size="large"
          alt={edits.title ? tCover('alt', { title: edits.title }) : ''}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FormField
            id={`${id}-title`}
            label={t('fields.title')}
            hint={hint('title', proposal.title)}
            error={issueText('title')}
          >
            <input
              id={`${id}-title`}
              value={edits.title}
              onChange={(event) => set('title')(event.target.value)}
              required
              aria-invalid={Boolean(issueText('title')) || undefined}
              aria-describedby={describedBy('title')}
              className={input}
            />
          </FormField>

          {attach ? (
            <p className="type-small text-text-muted">{t('authorsFromWork')}</p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 flex flex-wrap items-baseline gap-x-2 type-label text-text">
                {t('fields.authors')}
                {proposal.authorsSource && authors.map((a) => a.name).join('|') === initial.authors.join('|') && (
                  <span className="type-small text-text-muted">
                    {t('source', { source: sourceName(proposal.authorsSource) })}
                  </span>
                )}
              </legend>
              {authors.map((author, index) => (
                <div key={author.key} className="flex items-center gap-2">
                  <label htmlFor={`${id}-author-${author.key}`} className="sr-only">
                    {t('fields.author', { number: index + 1 })}
                  </label>
                  <input
                    id={`${id}-author-${author.key}`}
                    value={author.name}
                    onChange={(event) =>
                      setAuthors((current) =>
                        current.map((item) => (item.key === author.key ? { ...item, name: event.target.value } : item)),
                      )
                    }
                    aria-invalid={Boolean(issueText('authors')) || undefined}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => setAuthors((current) => current.filter((item) => item.key !== author.key))}
                    aria-label={t('fields.removeAuthor', {
                      name: author.name || t('fields.author', { number: index + 1 }),
                    })}
                    className="inline-flex size-[2.75rem] shrink-0 items-center justify-center rounded-pill text-text-muted hover:text-text"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
              {issueText('authors') && <p className="type-small text-danger">{issueText('authors')}</p>}
              <button
                type="button"
                onClick={() =>
                  setAuthors((current) => [
                    ...current,
                    { key: Math.max(-1, ...current.map((item) => item.key)) + 1, name: '' },
                  ])
                }
                className="inline-flex min-h-[2.75rem] items-center gap-1 self-start type-label text-link"
              >
                <PlusIcon />
                {t('fields.addAuthor')}
              </button>
            </fieldset>
          )}

          <FormField
            id={`${id}-publisher`}
            label={t('fields.publisher')}
            hint={hint('publisher', proposal.publisher)}
            error={issueText('publisher')}
          >
            <input
              id={`${id}-publisher`}
              value={edits.publisher}
              onChange={(event) => set('publisher')(event.target.value)}
              aria-invalid={Boolean(issueText('publisher')) || undefined}
              aria-describedby={describedBy('publisher')}
              className={input}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              id={`${id}-publishedYear`}
              label={t('fields.publishedYear')}
              hint={hint('publishedYear', proposal.publishedYear)}
              error={issueText('publishedYear')}
            >
              <input
                id={`${id}-publishedYear`}
                value={edits.publishedYear}
                onChange={(event) => set('publishedYear')(event.target.value)}
                inputMode="numeric"
                aria-invalid={Boolean(issueText('publishedYear')) || undefined}
                aria-describedby={describedBy('publishedYear')}
                className={input}
              />
            </FormField>
            <FormField
              id={`${id}-pageCount`}
              label={t('fields.pageCount')}
              hint={hint('pageCount', proposal.pageCount)}
              error={issueText('pageCount')}
            >
              <input
                id={`${id}-pageCount`}
                value={edits.pageCount}
                onChange={(event) => set('pageCount')(event.target.value)}
                inputMode="numeric"
                aria-invalid={Boolean(issueText('pageCount')) || undefined}
                aria-describedby={describedBy('pageCount')}
                className={input}
              />
            </FormField>
          </div>
          {proposal.pageCount && !proposal.pageCount.reliable && edits.pageCount === initial.pageCount && (
            <p className="type-small text-text-muted">{t('pagesUnreliable')}</p>
          )}

          <FormField
            id={`${id}-format`}
            label={t('fields.format')}
            hint={hint('format', proposal.format)}
            error={issueText('format')}
          >
            <select
              id={`${id}-format`}
              value={edits.format}
              onChange={(event) => set('format')(event.target.value)}
              className={input}
            >
              <option value="">{t('formats.none')}</option>
              {editionFormats.map((format) => (
                <option key={format} value={format}>
                  {t(`formats.${format}`)}
                </option>
              ))}
            </select>
          </FormField>

          {proposal.isbn13 && (
            <div className="flex flex-col gap-1">
              <p className="type-label text-text">{t('fields.isbn')}</p>
              <p className="type-body text-text">{proposal.isbn13}</p>
              {issueText('isbn') && <p className="type-small text-danger">{issueText('isbn')}</p>}
            </div>
          )}

          {proposal.description && (
            <details className="rounded-card border-(length:--border-rule) border-rule p-3">
              <summary className="min-h-[2.75rem] cursor-pointer content-center type-label text-text">
                {t('description')}
              </summary>
              <p className="mt-2 type-body whitespace-pre-line text-text">{proposal.description.value}</p>
              {!proposal.description.storable && (
                <p className="mt-2 type-small text-text-muted">{t('descriptionOnlyShown')}</p>
              )}
            </details>
          )}
        </div>
      </div>

      {failure && (
        <p role="alert" className="type-body text-danger">
          {t(`errors.${failure.reason}`)}
        </p>
      )}

      <Button type="submit" disabled={saving} className="self-stretch sm:self-start">
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
