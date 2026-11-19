'use client';

import type { CoverFillProgress } from '@libresca/data';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/button';

const card = 'flex flex-col gap-3 rounded-card border-(length:--border-ink) border-border bg-surface-raised p-4';

type Run =
  | { kind: 'idle' }
  | { kind: 'running'; found: number; remaining: number | null }
  | { kind: 'done'; found: number; missing: number }
  | { kind: 'stopped'; found: number; checked: number };

/**
 * "Copertine mancanti": walks the books of the Tana shown without a cover, a step at a
 * time (`POST /api/v1/covers/fill`), and fills what the sources have. A broken run can
 * resume from its cursor.
 */
export function FindCovers() {
  const t = useTranslations('me.covers');
  const router = useRouter();
  const [run, setRun] = useState<Run>({ kind: 'idle' });
  const cursor = useRef<{ after: string | null; googleCalls: number; found: number; checked: number }>({
    after: null,
    googleCalls: 0,
    found: 0,
    checked: 0,
  });
  const stop = useRef(false);

  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  async function start(resume: boolean) {
    if (!resume) cursor.current = { after: null, googleCalls: 0, found: 0, checked: 0 };
    stop.current = false;
    const state = cursor.current;
    setRun({ kind: 'running', found: state.found, remaining: null });

    while (!stop.current) {
      let progress: CoverFillProgress;
      try {
        const response = await fetch('/api/v1/covers/fill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ after: state.after, googleCalls: state.googleCalls }),
        });
        if (!response.ok) throw new Error(String(response.status));
        progress = (await response.json()) as CoverFillProgress;
      } catch {
        setRun({ kind: 'stopped', found: state.found, checked: state.checked });
        return;
      }

      state.found += progress.found;
      state.checked += progress.checked;
      state.googleCalls = progress.googleCalls;
      if (progress.next === null) {
        setRun({ kind: 'done', found: state.found, missing: state.checked - state.found });
        if (state.found > 0) router.refresh();
        return;
      }
      state.after = progress.next;
      setRun({ kind: 'running', found: state.found, remaining: progress.remaining });
    }
  }

  const running = run.kind === 'running';
  return (
    <section aria-labelledby="covers-heading" className={card}>
      <h2 id="covers-heading" className="type-heading text-text">
        {t('heading')}
      </h2>
      <p className="type-body text-text-muted">{t('intro')}</p>

      <div role="status" className="type-body text-text">
        {run.kind === 'running' && run.remaining !== null && (
          <p>{t('running', { found: run.found, remaining: run.remaining })}</p>
        )}
        {run.kind === 'done' && run.found + run.missing === 0 && <p>{t('allCovered')}</p>}
        {run.kind === 'done' && run.found + run.missing > 0 && (
          <>
            <p>{t('found', { count: run.found })}</p>
            {run.missing > 0 && <p className="text-text-muted">{t('missing', { count: run.missing })}</p>}
          </>
        )}
        {run.kind === 'stopped' && <p>{t('error')}</p>}
      </div>

      {run.kind === 'stopped' ? (
        <Button type="button" variant="secondary" className="self-start" onClick={() => void start(true)}>
          {t('resume')}
        </Button>
      ) : (
        run.kind !== 'done' && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={running}
            aria-busy={running}
            onClick={() => void start(false)}
          >
            {t('start')}
          </Button>
        )
      )}
    </section>
  );
}
