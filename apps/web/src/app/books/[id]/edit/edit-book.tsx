'use client';

import {
  type CatalogIssue,
  type EditionFormat,
  authorsForEdit,
  commonLanguages,
  editionFormats,
} from '@libresca/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useMemo, useState, useTransition } from 'react';

import { BookCover } from '@/components/book-cover';
import { Button, ButtonLink } from '@/components/button';

import { type CoverPhoto, CoverPhotoField } from '../../../add/cover-photo-field';
import { FormField, inputClasses as input } from '../../../add/form-field';
import { NameListField, nameItems } from '../../../add/name-list-field';
import { type CorrectionResult, saveCorrections } from '../actions';

interface WorkCard {
  id: string;
  title: string;
  authors: { id: string; name: string }[];
  firstPublishedYear: number | null;
  description: string | null;
}

interface EditionCard {
  id: string;
  title: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  format: EditionFormat | null;
  language: string | null;
  translators: string[];
  coverUrl: string | null;
}

type Field =
  | 'title'
  | 'authors'
  | 'firstPublishedYear'
  | 'description'
  | 'editionTitle'
  | 'publisher'
  | 'publishedYear'
  | 'pageCount'
  | 'translators'
  | 'cover';

/** Which field a validation issue belongs to. */
function fieldOf(part: 'work' | 'edition', path: string): Field | null {
  if (path === 'work.title') return 'title';
  if (path.startsWith('work.authors')) return 'authors';
  if (path === 'work.firstPublishedYear') return 'firstPublishedYear';
  if (path === 'work.description') return 'description';
  if (path.startsWith('edition.contributors')) return 'translators';
  const edition: Record<string, Field> = {
    'edition.title': 'editionTitle',
    'edition.publisher': 'publisher',
    'edition.publishedYear': 'publishedYear',
    'edition.pageCount': 'pageCount',
    'edition.coverPath': 'cover',
  };
  return part === 'edition' ? (edition[path] ?? null) : null;
}

const knownIssues = ['required', 'too_long', 'invalid_year', 'invalid_page_count', 'duplicate'] as const;

/** A number typed in a field, or `undefined` when empty; anything else is left for validation. */
function numberOf(value: string): number | undefined {
  const clean = value.trim();
  return clean === '' ? undefined : Number(clean);
}

/**
 * The correction form: the work (title, authors, first year, description) and one
 * edition (its details, translators, a new cover photo). Fields come filled with what the
 * catalog has; an emptied field is cleared.
 */
export function EditBook({
  work,
  edition,
  editions,
}: {
  work: WorkCard;
  edition: EditionCard;
  editions: { id: string; label: string }[];
}) {
  const t = useTranslations('edit');
  const tf = useTranslations('add.confirm');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(work.title);
  const [authors, setAuthors] = useState(() =>
    nameItems(
      work.authors.map((author) => author.name),
      true,
    ),
  );
  const [firstYear, setFirstYear] = useState(work.firstPublishedYear?.toString() ?? '');
  const [description, setDescription] = useState(work.description ?? '');
  const [editionTitle, setEditionTitle] = useState(edition.title ?? '');
  const [publisher, setPublisher] = useState(edition.publisher ?? '');
  const [publishedYear, setPublishedYear] = useState(edition.publishedYear?.toString() ?? '');
  const [pageCount, setPageCount] = useState(edition.pageCount?.toString() ?? '');
  const [format, setFormat] = useState<string>(edition.format ?? '');
  const [language, setLanguage] = useState(edition.language ?? '');
  const [translators, setTranslators] = useState(() => nameItems(edition.translators, false));
  const [photo, setPhoto] = useState<CoverPhoto | null>(null);
  const [failure, setFailure] = useState<Exclude<CorrectionResult, { ok: true }> | null>(null);
  const [saving, startSaving] = useTransition();

  const languages = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'language' });
    const codes = [...new Set([...commonLanguages, ...(edition.language ? [edition.language] : [])])];
    return codes.map((code) => ({ code, name: names.of(code) ?? code }));
  }, [locale, edition.language]);

  const issues: (CatalogIssue & { part: 'work' | 'edition' })[] =
    failure?.result.reason === 'invalid'
      ? failure.result.issues.map((issue) => ({ ...issue, part: failure.part }))
      : [];
  const issueText = (field: Field) => {
    const issue = issues.find((item) => fieldOf(item.part, item.path) === field);
    if (!issue) return undefined;
    return tf(`issues.${knownIssues.find((code) => code === issue.code) ?? 'other'}`);
  };
  const described = (field: Field) => (issueText(field) ? `${id}-${field}-error` : undefined);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveCorrections(
        work.id,
        edition.id,
        {
          title,
          authors: authorsForEdit(
            authors.map((item) => item.name),
            work.authors,
          ),
          firstPublishedYear: numberOf(firstYear),
          description,
        },
        {
          title: editionTitle,
          publisher,
          publishedYear: numberOf(publishedYear),
          pageCount: numberOf(pageCount),
          format: format === '' ? undefined : (format as EditionFormat),
          language,
          translators: translators.map((item) => item.name),
          coverPath: photo?.path,
        },
      );
      if (result.ok) return router.push(`/books/${work.id}`);
      setFailure(result);
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8" noValidate>
      <section aria-labelledby={`${id}-work`} className="flex flex-col gap-4">
        <h2 id={`${id}-work`} className="type-heading text-text">
          {t('work')}
        </h2>
        <FormField id={`${id}-title`} label={tf('fields.title')} error={issueText('title')}>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            aria-invalid={Boolean(issueText('title')) || undefined}
            aria-describedby={described('title')}
            className={input}
          />
        </FormField>
        <NameListField
          id={`${id}-author`}
          legend={tf('fields.authors')}
          items={authors}
          onChange={setAuthors}
          itemLabel={(number) => tf('fields.author', { number })}
          removeLabel={(name) => tf('fields.removeAuthor', { name })}
          addLabel={tf('fields.addAuthor')}
          error={issueText('authors')}
        />
        <FormField id={`${id}-firstYear`} label={t('firstPublishedYear')} error={issueText('firstPublishedYear')}>
          <input
            id={`${id}-firstYear`}
            value={firstYear}
            onChange={(event) => setFirstYear(event.target.value)}
            inputMode="numeric"
            aria-invalid={Boolean(issueText('firstPublishedYear')) || undefined}
            aria-describedby={described('firstPublishedYear')}
            className={input}
          />
        </FormField>
        <FormField id={`${id}-description`} label={t('description')} error={issueText('description')}>
          <textarea
            id={`${id}-description`}
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={Boolean(issueText('description')) || undefined}
            aria-describedby={described('description')}
            className={input}
          />
        </FormField>
      </section>

      <section aria-labelledby={`${id}-edition`} className="flex flex-col gap-4">
        <h2 id={`${id}-edition`} className="type-heading text-text">
          {t('edition')}
        </h2>
        {editions.length > 1 && (
          <FormField id={`${id}-which`} label={t('chooseEdition')}>
            <select
              id={`${id}-which`}
              value={edition.id}
              onChange={(event) => router.replace(`/books/${work.id}/edit?edition=${event.target.value}`)}
              className={input}
            >
              {editions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col gap-3 sm:w-[11rem]">
            <BookCover title={title} url={photo?.url ?? edition.coverUrl} size="large" />
            <CoverPhotoField photo={photo} onChange={setPhoto} />
            {issueText('cover') && <p className="type-small text-danger">{issueText('cover')}</p>}
          </div>
          <div className="flex min-w-[0] flex-1 flex-col gap-4">
            <FormField
              id={`${id}-editionTitle`}
              label={t('editionTitle')}
              hint={t('editionTitleHint')}
              error={issueText('editionTitle')}
            >
              <input
                id={`${id}-editionTitle`}
                value={editionTitle}
                onChange={(event) => setEditionTitle(event.target.value)}
                aria-invalid={Boolean(issueText('editionTitle')) || undefined}
                className={input}
              />
            </FormField>
            <FormField id={`${id}-publisher`} label={tf('fields.publisher')} error={issueText('publisher')}>
              <input
                id={`${id}-publisher`}
                value={publisher}
                onChange={(event) => setPublisher(event.target.value)}
                aria-invalid={Boolean(issueText('publisher')) || undefined}
                className={input}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField id={`${id}-year`} label={tf('fields.publishedYear')} error={issueText('publishedYear')}>
                <input
                  id={`${id}-year`}
                  value={publishedYear}
                  onChange={(event) => setPublishedYear(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(issueText('publishedYear')) || undefined}
                  className={input}
                />
              </FormField>
              <FormField id={`${id}-pages`} label={tf('fields.pageCount')} error={issueText('pageCount')}>
                <input
                  id={`${id}-pages`}
                  value={pageCount}
                  onChange={(event) => setPageCount(event.target.value)}
                  inputMode="numeric"
                  aria-invalid={Boolean(issueText('pageCount')) || undefined}
                  className={input}
                />
              </FormField>
            </div>
            <FormField id={`${id}-format`} label={tf('fields.format')}>
              <select
                id={`${id}-format`}
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className={input}
              >
                <option value="">{tf('formats.none')}</option>
                {editionFormats.map((value) => (
                  <option key={value} value={value}>
                    {tf(`formats.${value}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`${id}-language`} label={tf('fields.language')}>
              <select
                id={`${id}-language`}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={input}
              >
                <option value="">{tf('languageUnknown')}</option>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <NameListField
              id={`${id}-translator`}
              legend={tf('fields.translators')}
              items={translators}
              onChange={setTranslators}
              itemLabel={(number) => tf('fields.translator', { number })}
              removeLabel={(name) => tf('fields.removeTranslator', { name })}
              addLabel={tf('fields.addTranslator')}
              error={issueText('translators')}
            />
          </div>
        </div>
      </section>

      {failure && failure.result.reason !== 'invalid' && (
        <p role="alert" className="type-body text-danger">
          {t(`errors.${failure.result.reason}`)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        <ButtonLink href={`/books/${work.id}`} variant="quiet">
          {t('cancel')}
        </ButtonLink>
      </div>
    </form>
  );
}
