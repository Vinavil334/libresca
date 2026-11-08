'use client';

import type { WorkWithAuthors } from '@libresca/data';
import { parseBookQuery } from '@libresca/domain';
import {
  type BookSearchResponse,
  type CandidateEdition,
  type EditionProposal,
  type IsbnLookupResponse,
  type MatchedCandidate,
  candidateProposal,
  emptyProposal,
} from '@libresca/metadata/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/button';
import { SearchIcon } from '@/components/icons';

import { ConfirmEdition, type WorkMatch } from './confirm-edition';
import { SearchResults } from './search-results';

type Failure = 'network' | 'rateLimited' | 'session' | 'tooShort' | 'invalidIsbn';

interface Confirming {
  proposal: EditionProposal;
  match?: WorkMatch;
  notice?: 'notFound' | 'manual';
}

type Fetched<T> = { ok: true; status: number; body: T } | { ok: false; failure: Failure };

/** Calls `/api/v1` with the session cookie. 404 is an answer (no source knows the ISBN), not a failure. */
async function getJson<T>(url: string): Promise<Fetched<T>> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) return { ok: false, failure: 'session' };
    if (response.status === 429) return { ok: false, failure: 'rateLimited' };
    if (!response.ok && response.status !== 404) return { ok: false, failure: 'network' };
    return { ok: true, status: response.status, body: (await response.json()) as T };
  } catch {
    return { ok: false, failure: 'network' };
  }
}

/**
 * The add screen: one search box for a title, an author or an ISBN, the results, then
 * the card to confirm. Searching and saving live in the packages and in `/api/v1`;
 * this component only moves between the steps.
 */
export function AddBook() {
  const t = useTranslations('add');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [results, setResults] = useState<BookSearchResponse<WorkWithAuthors> | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);

  async function lookUpIsbn(isbn13: string, match?: WorkMatch) {
    setLoading(true);
    setFailure(null);
    const answer = await getJson<IsbnLookupResponse<{ work_id: string }>>(`/api/v1/books/isbn/${isbn13}`);
    setLoading(false);
    if (!answer.ok) return setFailure(answer.failure);

    const body = answer.body;
    if (body.status === 'catalog') return router.push(`/books/${body.edition.work_id}?found=1`);
    if (body.status === 'proposal') {
      const sameWork = body.catalogWork && {
        workId: body.catalogWork.id,
        title: body.catalogWork.title,
        basis: 'identifier' as const,
      };
      return setConfirming({ proposal: body.proposal, match: sameWork || match });
    }
    setConfirming({ proposal: emptyProposal(isbn13), match, notice: 'notFound' });
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseBookQuery(query);
    if (!parsed) return setFailure('tooShort');
    if (parsed.kind === 'invalid_isbn') return setFailure('invalidIsbn');
    if (parsed.kind === 'isbn') return lookUpIsbn(parsed.isbn13);

    setLoading(true);
    setFailure(null);
    const answer = await getJson<BookSearchResponse<WorkWithAuthors>>(
      `/api/v1/books/search?q=${encodeURIComponent(parsed.query)}`,
    );
    setLoading(false);
    if (!answer.ok) return setFailure(answer.failure);
    setResults(answer.body);
  }

  function chooseEdition(candidate: MatchedCandidate, edition: CandidateEdition) {
    const found = candidate.catalogMatch;
    const match: WorkMatch | undefined = found && {
      workId: found.workId,
      basis: found.basis,
      title: results?.catalog.find((work) => work.id === found.workId)?.title,
    };
    if (edition.isbn13) return lookUpIsbn(edition.isbn13, match);
    setConfirming({ proposal: candidateProposal(candidate, edition), match });
  }

  if (confirming) {
    return (
      <ConfirmEdition
        key={confirming.proposal.isbn13 ?? confirming.proposal.editionExternalIds[0]?.value ?? 'manual'}
        proposal={confirming.proposal}
        match={confirming.match}
        notice={confirming.notice}
        onBack={() => setConfirming(null)}
      />
    );
  }

  const failureText: Record<Failure, string> = {
    network: t('errors.network'),
    rateLimited: t('errors.rateLimited'),
    session: t('errors.session'),
    tooShort: t('search.tooShort'),
    invalidIsbn: t('search.invalidIsbn'),
  };

  return (
    <div className="flex flex-col gap-6">
      <form role="search" onSubmit={search} className="flex flex-col gap-3 sm:flex-row" noValidate>
        <label htmlFor="book-query" className="sr-only">
          {t('search.label')}
        </label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted" />
          <input
            id="book-query"
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            autoComplete="off"
            enterKeyHint="search"
            aria-invalid={failure === 'tooShort' || failure === 'invalidIsbn' || undefined}
            aria-describedby={failure ? 'search-failure' : undefined}
            className="min-h-[3.25rem] w-full rounded-pill border-(length:--border-ink) border-border bg-surface-raised py-3 pr-4 pl-[3rem] type-body text-text placeholder:text-text-muted"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {t('search.submit')}
        </Button>
      </form>

      <div role="status" aria-live="polite" className="type-body text-text-muted empty:hidden">
        {loading
          ? t('search.loading')
          : results
            ? t('results.summary', { count: results.catalog.length + results.candidates.length })
            : ''}
      </div>

      {failure && !loading && (
        <p id="search-failure" role="alert" className="type-body text-danger">
          {failureText[failure]}
        </p>
      )}

      {results && !loading && (
        <SearchResults
          results={results}
          onChoose={chooseEdition}
          onManual={() => setConfirming({ proposal: emptyProposal(), notice: 'manual' })}
        />
      )}
    </div>
  );
}
