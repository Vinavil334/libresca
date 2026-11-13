'use client';

import type { ImportProgress, StoredCandidate } from '@libresca/data';
import { type GoodreadsParse, localDate, parseGoodreadsExport, summarizeGoodreads } from '@libresca/domain';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';

import { BookCover } from '@/components/book-cover';
import { Button, ButtonLink } from '@/components/button';

/** A row in review, as the page hands it over. */
export interface ReviewItem {
  rowId: string;
  line: number;
  title: string;
  author: string | null;
  candidates: StoredCandidate[];
}

type StartError = 'empty' | 'not_goodreads' | 'too_large' | 'failed' | 'network' | 'unreadable';
type Parsed = Extract<GoodreadsParse, { ok: true }>;

const card = 'flex flex-col gap-3 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4';
const today = () => localDate(new Date());

async function postJson(url: string, body: BodyInit, contentType: string): Promise<Response | null> {
  try {
    return await fetch(url, { method: 'POST', body, headers: { 'Content-Type': contentType } });
  } catch {
    return null;
  }
}

/**
 * The import, in four moments: choose the file, look at what it holds, follow the steps,
 * settle the doubtful books. The file is read in the browser for the preview and sent as
 * it is: the server parses it again before saving anything.
 */
export function ImportGoodreads({ latest, review }: { latest: ImportProgress | null; review: ReviewItem[] }) {
  const t = useTranslations('import');
  const router = useRouter();
  const [file, setFile] = useState<{ csv: string; parsed: Parsed } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(latest);
  const [fresh, setFresh] = useState(latest === null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<StartError | null>(null);
  const stop = useRef(false);

  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  async function run(jobId: string) {
    stop.current = false;
    setRunning(true);
    setError(null);
    while (!stop.current) {
      const response = await postJson(
        `/api/v1/imports/${jobId}/step`,
        JSON.stringify({ today: today() }),
        'application/json',
      );
      if (!response?.ok) {
        setError('network');
        break;
      }
      const next = (await response.json()) as ImportProgress;
      setProgress(next);
      if (next.status === 'finished') {
        router.refresh();
        break;
      }
    }
    setRunning(false);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setError(null);
    let csv: string;
    try {
      csv = await chosen.text();
    } catch {
      return setError('unreadable');
    }
    const parsed = parseGoodreadsExport(csv);
    if (!parsed.ok) return setError(parsed.reason);
    if (parsed.books.length === 0) return setError('empty');
    setFile({ csv, parsed });
  }

  async function start() {
    if (!file) return;
    setError(null);
    const response = await postJson('/api/v1/imports', file.csv, 'text/csv');
    if (!response) return setError('network');
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: StartError };
      return setError(body.error && body.error in { empty: 1, not_goodreads: 1, too_large: 1 } ? body.error : 'failed');
    }
    const started = (await response.json()) as ImportProgress;
    setProgress(started);
    setFresh(false);
    setFile(null);
    void run(started.jobId);
  }

  const errorText = error && (
    <p role="alert" className="type-body text-danger">
      {t(`errors.${error}`)}
    </p>
  );

  if (!fresh && progress) {
    return (
      <>
        <ProgressCard
          progress={progress}
          running={running}
          onResume={() => void run(progress.jobId)}
          onPause={() => {
            stop.current = true;
          }}
          onAgain={() => {
            setFresh(true);
            setFile(null);
          }}
        />
        {errorText}
        {review.length > 0 && <Review jobId={progress.jobId} items={review} />}
      </>
    );
  }

  return (
    <>
      <p className="type-body text-text">{t('how')}</p>
      {file ? (
        <Summary parsed={file.parsed} onStart={() => void start()} onAnother={() => setFile(null)} />
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="goodreads-file" className="type-label text-text">
            {t('fileLabel')}
          </label>
          <input
            id="goodreads-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void chooseFile(event)}
            className="type-body text-text file:mr-4 file:min-h-[3rem] file:rounded-pill file:border-(length:--border-ink) file:border-border file:bg-surface-raised file:px-6 file:type-label file:text-text"
          />
        </div>
      )}
      {errorText}
    </>
  );
}

function Summary({ parsed, onStart, onAnother }: { parsed: Parsed; onStart: () => void; onAnother: () => void }) {
  const t = useTranslations('import.summary');
  const [starting, startStarting] = useTransition();
  const summary = summarizeGoodreads(parsed.books);
  const lines = [
    t('statuses', summary.byStatus),
    t('rated', { count: summary.rated }),
    t('copies', { count: summary.copies }),
    t('noIsbn', { count: summary.books - summary.withIsbn }),
    t('noDate', { count: summary.readWithoutDate }),
    t('rereads', { count: summary.rereads }),
    t('startDates'),
  ].filter(Boolean);

  return (
    <section aria-labelledby="import-summary" className={card}>
      <h2 id="import-summary" className="type-heading text-text">
        {t('heading')}
      </h2>
      <p className="type-title text-text">{t('books', { count: summary.books })}</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 type-body text-text">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {summary.shelves.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="type-label text-text">{t('shelves')}</p>
          <p className="type-small text-text-muted">
            {summary.shelves.map((shelf) => t('shelf', { name: shelf.name, count: shelf.books })).join(' · ')}
          </p>
        </div>
      )}
      {parsed.issues.length > 0 && (
        <details className="rounded-card border-(length:--border-rule) border-rule p-3">
          <summary className="min-h-[2.75rem] cursor-pointer content-center type-label text-text">
            {t('issues', { count: parsed.issues.length })}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 type-small text-text-muted">
            {parsed.issues.map((issue) => (
              <li key={`${issue.line}-${issue.code}`}>
                {issue.code === 'custom_shelf'
                  ? t('issue.custom_shelf', { line: issue.line, shelf: issue.shelf })
                  : t(`issue.${issue.code}`, { line: issue.line })}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={starting} onClick={() => startStarting(async () => onStart())}>
          {t('start', { count: summary.books })}
        </Button>
        <Button type="button" variant="quiet" onClick={onAnother}>
          {t('another')}
        </Button>
      </div>
    </section>
  );
}

function ProgressCard({
  progress,
  running,
  onResume,
  onPause,
  onAgain,
}: {
  progress: ImportProgress;
  running: boolean;
  onResume: () => void;
  onPause: () => void;
  onAgain: () => void;
}) {
  const t = useTranslations('import');
  const { counts, total } = progress;
  const handled = total - counts.pending;
  if (progress.status === 'finished') {
    return (
      <section aria-labelledby="import-done" className={card}>
        <h2 id="import-done" className="type-display-l text-text">
          {t('done.heading')}
        </h2>
        <p role="status" className="type-body text-text">
          {t('done.text', { imported: counts.imported })}
        </p>
        {counts.skipped > 0 && (
          <p className="type-small text-text-muted">{t('done.skipped', { count: counts.skipped })}</p>
        )}
        {counts.failed > 0 && (
          <p className="type-small text-text-muted">{t('done.failed', { count: counts.failed })}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/">{t('done.toTana')}</ButtonLink>
          <Button type="button" variant="quiet" onClick={onAgain}>
            {t('done.again')}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="import-progress" className={card}>
      <h2 id="import-progress" className="type-heading text-text">
        {t('progress.heading')}
      </h2>
      <div
        role="progressbar"
        aria-labelledby="import-progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={handled}
        aria-valuetext={t('progress.status', { done: handled, total })}
        className="h-[0.75rem] w-full overflow-hidden rounded-pill border-(length:--border-ink) border-border bg-surface"
      >
        <div
          className="h-full bg-honey transition-[width] duration-(--motion-gentle) ease-gentle motion-reduce:transition-none"
          style={{ width: `${total > 0 ? Math.round((handled / total) * 100) : 0}%` }}
        />
      </div>
      <p role="status" className="type-body text-text">
        {t('progress.status', { done: handled, total })}
      </p>
      <p className="type-small text-text-muted">{t('progress.keepOpen')}</p>
      {running ? (
        <Button type="button" variant="quiet" onClick={onPause} className="self-start">
          {t('progress.pause')}
        </Button>
      ) : (
        <Button type="button" onClick={onResume} className="self-start">
          {t('progress.resume')}
        </Button>
      )}
    </section>
  );
}

/** The books without ISBN the sources matched only roughly: the user picks. */
function Review({ jobId, items }: { jobId: string; items: ReviewItem[] }) {
  const t = useTranslations('import.review');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function settle(rowId: string, choice: { kind: 'candidate'; key: string } | { kind: 'as_exported' | 'skip' }) {
    setBusy(rowId);
    setFailed(null);
    const response = await postJson(
      `/api/v1/imports/${jobId}/rows/${rowId}`,
      JSON.stringify({ ...choice, today: today() }),
      'application/json',
    );
    setBusy(null);
    if (!response?.ok) return setFailed(rowId);
    router.refresh();
  }

  return (
    <section aria-labelledby="import-review" className="flex flex-col gap-4">
      <h2 id="import-review" className="type-heading text-text">
        {t('heading')}
      </h2>
      <p className="type-body text-text">{t('intro')}</p>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.rowId} className={card} aria-busy={busy === item.rowId || undefined}>
            <div className="flex flex-col">
              <p className="type-title-s wrap-break-word text-text">{item.title}</p>
              <p className="type-small text-text-muted">
                {[item.author, t('row', { line: item.line })].filter(Boolean).join(' · ')}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {item.candidates.map((candidate) => (
                <li
                  key={candidate.key}
                  className="flex items-center gap-3 rounded-card border-(length:--border-rule) border-rule p-2"
                >
                  <BookCover title={candidate.title} url={candidate.coverUrl} size="small" />
                  <div className="flex min-w-[0] flex-1 flex-col">
                    <span className="type-body-strong wrap-break-word text-text">{candidate.title}</span>
                    <span className="type-small wrap-break-word text-text-muted">
                      {[candidate.authors.join(', '), candidate.year ? String(candidate.year) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void settle(item.rowId, { kind: 'candidate', key: candidate.key })}
                    aria-label={`${t('pick')}: ${candidate.title}`}
                  >
                    {t('pick')}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-4">
              <Button
                type="button"
                variant="quiet"
                disabled={busy !== null}
                onClick={() => void settle(item.rowId, { kind: 'as_exported' })}
              >
                {t('asExported')}
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy !== null}
                onClick={() => void settle(item.rowId, { kind: 'skip' })}
              >
                {t('skip')}
              </Button>
            </div>
            {failed === item.rowId && (
              <p role="alert" className="type-small text-danger">
                {t('failed')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
