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
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/button';
import { ScanIcon, SearchIcon } from '@/components/icons';

import { BarcodeScanner } from './barcode-scanner';
import { ConfirmEdition, type WorkMatch } from './confirm-edition';
import { PhotoCodeButton, type PhotoCodeResult } from './photo-code-button';
import { SearchResults } from './search-results';

type Failure =
  'network' | 'rateLimited' | 'session' | 'tooShort' | 'invalidIsbn' | 'photoEmpty' | 'photoNotIsbn' | 'unsupported';

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
 * The add screen: the barcode scanner, one search box for a title, an author or an ISBN,
 * the results, then the card to confirm. Searching and saving live in the packages and
 * in `/api/v1`; this component only moves between the steps.
 *
 * `startScanning`: open the camera at once, as after "Scansiona un altro".
 * `initialQuery`: search at once, as from "Cercalo nel catalogo" in the Tana.
 */
export function AddBook({ startScanning = false, initialQuery }: { startScanning?: boolean; initialQuery?: string }) {
  const t = useTranslations('add');
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [results, setResults] = useState<BookSearchResponse<WorkWithAuthors> | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [scanning, setScanning] = useState(startScanning);
  const searchedInitial = useRef(false);

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

  /** A code read by the camera or from a photo goes down the same path as a typed ISBN. */
  function scanned(isbn13: string) {
    setScanning(false);
    setQuery(isbn13);
    void lookUpIsbn(isbn13);
  }

  function photoRead(result: PhotoCodeResult) {
    if (result === 'unsupported') return setFailure('unsupported');
    if (result === null) return setFailure('photoEmpty');
    if (result.kind === 'not_isbn') return setFailure('photoNotIsbn');
    scanned(result.isbn13);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The form is the source of truth: text typed before hydration never reached the state.
    await searchFor(String(new FormData(event.currentTarget).get('q') ?? ''));
  }

  async function searchFor(typed: string) {
    setQuery(typed);
    const parsed = parseBookQuery(typed);
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

  // A search handed over in the address runs once, as if typed and sent.
  useEffect(() => {
    if (!initialQuery || searchedInitial.current) return;
    searchedInitial.current = true;
    void searchFor(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

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
    photoEmpty: t('scan.errors.photoEmpty'),
    photoNotIsbn: t('scan.errors.photoNotIsbn'),
    unsupported: t('scan.errors.unsupported'),
  };

  return (
    <div className="flex flex-col gap-6">
      {scanning && (
        <BarcodeScanner
          onIsbn={scanned}
          onClose={() => setScanning(false)}
          fallback={<PhotoCodeButton onResult={photoRead} />}
        />
      )}

      <div className="flex flex-col gap-2">
        <Button type="button" onClick={() => setScanning(true)} className="self-stretch sm:self-start">
          <ScanIcon />
          {t('scan.open')}
        </Button>
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="type-small text-text-muted">{t('scan.or')}</span>
          <PhotoCodeButton onResult={photoRead} variant="quiet" />
        </div>
      </div>

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
