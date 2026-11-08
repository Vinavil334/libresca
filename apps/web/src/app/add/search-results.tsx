'use client';

import type { WorkWithAuthors } from '@libresca/data';
import type { BookSearchResponse, CandidateEdition, MatchedCandidate } from '@libresca/metadata/client';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/button';

const card = 'rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4 shadow-card';

function EditionButton({
  edition,
  onChoose,
}: {
  edition: CandidateEdition;
  onChoose: (edition: CandidateEdition) => void;
}) {
  const t = useTranslations('add.results');
  const details = [
    edition.publisher ?? t('unknownPublisher'),
    edition.publishedYear === undefined ? null : String(edition.publishedYear),
    edition.isbn13 ?? t('noIsbn'),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <button
        type="button"
        onClick={() => onChoose(edition)}
        aria-label={t('chooseEditionLabel', { details })}
        className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-card border-(length:--border-rule) border-rule px-3 py-2 text-left type-small text-text hover:border-border"
      >
        <BookCover title={edition.title ?? ''} url={edition.cover?.url} size="small" />
        <span className="wrap-break-word">{details}</span>
      </button>
    </li>
  );
}

function Candidate({
  candidate,
  onChoose,
}: {
  candidate: MatchedCandidate;
  onChoose: (candidate: MatchedCandidate, edition: CandidateEdition) => void;
}) {
  const t = useTranslations('add.results');
  const format = useFormatter();
  const match = candidate.catalogMatch;
  return (
    <li className={card}>
      <div className="flex gap-4">
        <BookCover title={candidate.title} url={candidate.cover?.url} />
        <div className="flex min-w-[0] flex-col gap-1">
          <h3 className="type-title wrap-break-word text-text">{candidate.title}</h3>
          {candidate.authors.length > 0 && (
            <p className="type-body wrap-break-word text-text">
              {format.list(candidate.authors, { type: 'conjunction' })}
            </p>
          )}
          <p className="type-small text-text-muted">
            {[
              candidate.firstPublishedYear === undefined ? null : String(candidate.firstPublishedYear),
              candidate.editionCount === undefined ? null : t('knownEditions', { count: candidate.editionCount }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {match && (
            <Link href={`/books/${match.workId}`} className="type-label text-link underline underline-offset-4">
              {match.basis === 'identifier' ? t('inCatalog') : t('maybeInCatalog')}
            </Link>
          )}
        </div>
      </div>
      <p className="mt-4 mb-2 type-small text-text-muted">{t('chooseEdition')}</p>
      <ul className="flex flex-col gap-2">
        {candidate.editions.map((edition) => (
          <EditionButton
            key={`${edition.source}:${edition.editionId}`}
            edition={edition}
            onChoose={(chosen) => onChoose(candidate, chosen)}
          />
        ))}
      </ul>
    </li>
  );
}

export function SearchResults({
  results,
  onChoose,
  onManual,
}: {
  results: BookSearchResponse<WorkWithAuthors>;
  onChoose: (candidate: MatchedCandidate, edition: CandidateEdition) => void;
  onManual: () => void;
}) {
  const t = useTranslations('add.results');
  const format = useFormatter();
  const empty = results.catalog.length === 0 && results.candidates.length === 0;
  const sourceDown = Object.values(results.sources).includes('unavailable');

  return (
    <div className="flex flex-col gap-8">
      {sourceDown && <p className="type-small text-text-muted">{t('sourcesDown')}</p>}

      {results.catalog.length > 0 && (
        <section aria-labelledby="catalog-heading" className="flex flex-col gap-3">
          <h2 id="catalog-heading" className="type-heading text-text">
            {t('catalog')}
          </h2>
          <ul className="flex flex-col gap-3">
            {results.catalog.map((work) => (
              <li key={work.id}>
                <Link href={`/books/${work.id}`} className={`${card} flex items-center gap-4`}>
                  <BookCover title={work.title} size="small" />
                  <span className="flex min-w-[0] flex-col">
                    <span className="type-title-s wrap-break-word text-text">{work.title}</span>
                    {work.authors.length > 0 && (
                      <span className="type-small wrap-break-word text-text-muted">
                        {format.list(
                          work.authors.map((author) => author.name),
                          { type: 'conjunction' },
                        )}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.candidates.length > 0 && (
        <section aria-labelledby="found-heading" className="flex flex-col gap-3">
          <h2 id="found-heading" className="type-heading text-text">
            {t('found')}
          </h2>
          <ul className="flex flex-col gap-4">
            {results.candidates.map((candidate) => (
              <Candidate key={candidate.key} candidate={candidate} onChoose={onChoose} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col items-start gap-2">
        <p className="type-body text-text">{empty ? t('empty') : t('notThere')}</p>
        <Button type="button" variant="secondary" onClick={onManual}>
          {t('manual')}
        </Button>
      </div>
    </div>
  );
}
