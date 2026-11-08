'use client';

import type { CreateEditionResult } from '@libresca/data';
import { type CatalogIssue, commonLanguages, editionFormats } from '@libresca/domain';
import {
  type EditionProposal,
  type ProposalEdits,
  type Sourced,
  type ValueSource,
  editsFromProposal,
} from '@libresca/metadata/client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';
import { BackIcon } from '@/components/icons';

import { addEdition, discardCover } from './actions';
import { type CoverPhoto, CoverPhotoField } from './cover-photo-field';
import { FormField, inputClasses as input } from './form-field';
import { NameListField, nameItems } from './name-list-field';

/** A catalog work this edition belongs to (`identifier`) or may belong to (`title_author`). */
export interface WorkMatch {
  workId: string;
  title?: string;
  basis: 'identifier' | 'title_author';
}

type Field =
  | 'title'
  | 'authors'
  | 'translators'
  | 'publisher'
  | 'publishedYear'
  | 'pageCount'
  | 'isbn'
  | 'format'
  | 'language'
  | 'cover';

/** Which form field a validation issue belongs to; anything else is shown above the button. */
function fieldOf(path: string): Field | null {
  if (path === 'work.title' || path === 'edition.title') return 'title';
  if (path.startsWith('work.authors')) return 'authors';
  if (path.startsWith('edition.contributors')) return 'translators';
  const edition: Record<string, Field> = {
    'edition.publisher': 'publisher',
    'edition.publishedYear': 'publishedYear',
    'edition.pageCount': 'pageCount',
    'edition.isbn': 'isbn',
    'edition.format': 'format',
    'edition.language': 'language',
    'edition.coverPath': 'cover',
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

/** Plain fields of the form; names and the photo have their own state. */
type PlainEdits = Omit<ProposalEdits, 'authors' | 'translators' | 'coverPhoto'>;

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
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [initial] = useState(() => editsFromProposal(proposal));
  const [edits, setEdits] = useState<PlainEdits>(initial);
  const [authors, setAuthors] = useState(() => nameItems(initial.authors, true));
  const [translators, setTranslators] = useState(() => nameItems(initial.translators, false));
  const [photo, setPhoto] = useState<CoverPhoto | null>(null);
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
  const hint = (field: keyof PlainEdits, sourced: Sourced<unknown> | undefined) =>
    sourced && edits[field] === initial[field] ? t('source', { source: sourceName(sourced.source) }) : undefined;
  const namesHint = (names: string[], proposed: string[], source: ValueSource | undefined) =>
    source && names.join('|') === proposed.join('|') ? t('source', { source: sourceName(source) }) : undefined;

  const set = (field: keyof PlainEdits) => (value: string) => setEdits((current) => ({ ...current, [field]: value }));

  // Languages by name in the user's language; a code from the sources outside the list stays available.
  const languages = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'language' });
    const codes = [...new Set([...commonLanguages, ...(initial.language ? [initial.language] : [])])];
    return codes.map((code) => ({ code, name: names.of(code) ?? code }));
  }, [locale, initial.language]);
  const translatorSource = proposal.contributors.find((c) => c.role === 'translator')?.source;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (match && sameWork === null) return setAskAnswer(true);
    startSaving(async () => {
      const result = await addEdition({
        proposal,
        edits: {
          ...edits,
          authors: authors.map((author) => author.name),
          translators: translators.map((translator) => translator.name),
          coverPhoto: photo?.path,
        },
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
          onClick={() => {
            if (photo) void discardCover(photo.path);
            onBack();
          }}
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
        <div className="flex flex-col gap-3 sm:w-[11rem]">
          <BookCover
            title={edits.title || matchTitle || ''}
            url={photo?.url ?? proposal.cover?.url}
            size="large"
            alt={edits.title ? tCover('alt', { title: edits.title }) : ''}
          />
          <CoverPhotoField photo={photo} onChange={setPhoto} />
          {issueText('cover') && <p className="type-small text-danger">{issueText('cover')}</p>}
        </div>

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
            <NameListField
              id={`${id}-author`}
              legend={t('fields.authors')}
              hint={namesHint(
                authors.map((a) => a.name),
                initial.authors,
                proposal.authorsSource,
              )}
              items={authors}
              onChange={setAuthors}
              itemLabel={(number) => t('fields.author', { number })}
              removeLabel={(name) => t('fields.removeAuthor', { name })}
              addLabel={t('fields.addAuthor')}
              error={issueText('authors')}
            />
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

          <FormField
            id={`${id}-language`}
            label={t('fields.language')}
            hint={hint('language', proposal.language)}
            error={issueText('language')}
          >
            <select
              id={`${id}-language`}
              value={edits.language}
              onChange={(event) => set('language')(event.target.value)}
              className={input}
            >
              <option value="">{t('languageUnknown')}</option>
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </FormField>

          <NameListField
            id={`${id}-translator`}
            legend={t('fields.translators')}
            hint={namesHint(
              translators.map((item) => item.name),
              initial.translators,
              translatorSource,
            )}
            items={translators}
            onChange={setTranslators}
            itemLabel={(number) => t('fields.translator', { number })}
            removeLabel={(name) => t('fields.removeTranslator', { name })}
            addLabel={t('fields.addTranslator')}
            error={issueText('translators')}
          />

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
