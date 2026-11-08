'use client';

import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/button';
import { CloseIcon } from '@/components/icons';
import { bookDetector, readBookCode } from '@/lib/barcode';

type ScannerState = 'starting' | 'scanning' | 'denied' | 'noCamera' | 'failed' | 'unsupported';

/** Pause between two reads of the video: fast enough to feel instant, light on old phones. */
const readEveryMs = 120;

function cameraFailure(error: unknown): ScannerState {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'noCamera';
  return 'failed';
}

/**
 * Full-screen camera that reads the ISBN barcode on the back of a book. The rear camera
 * when there is one; the light when the phone allows it. As soon as an ISBN is read the
 * camera stops and `onIsbn` receives it. When the camera cannot start, `fallback`
 * (photo of the code) is offered instead.
 */
export function BarcodeScanner({
  onIsbn,
  onClose,
  fallback,
}: {
  onIsbn: (isbn13: string) => void;
  onClose: () => void;
  fallback: ReactNode;
}) {
  const t = useTranslations('add.scan');
  const video = useRef<HTMLVideoElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const found = useRef(onIsbn);
  const [state, setState] = useState<ScannerState>('starting');
  const [notIsbn, setNotIsbn] = useState(false);
  const [torch, setTorch] = useState({ available: false, on: false });

  useEffect(() => {
    found.current = onIsbn;
  }, [onIsbn]);

  useEffect(() => {
    closeButton.current?.focus();
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((item) => item.stop());
    };

    async function start() {
      const reader = await bookDetector();
      if (stopped) return;
      if (!reader) return setState('unsupported');
      if (!navigator.mediaDevices?.getUserMedia) return setState('noCamera');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        return setState(cameraFailure(error));
      }
      const element = video.current;
      if (stopped || !element) return stop();
      element.srcObject = stream;
      await element.play().catch(() => undefined);
      track.current = stream.getVideoTracks()[0] ?? null;
      const capabilities = track.current?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorch({ available: Boolean(capabilities?.torch), on: false });
      setState('scanning');

      const read = async () => {
        if (stopped) return;
        if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const code = await readBookCode(reader, element);
          if (stopped) return;
          if (code?.kind === 'isbn') {
            stop();
            navigator.vibrate?.(40);
            return found.current(code.isbn13);
          }
          if (code?.kind === 'not_isbn') setNotIsbn(true);
        }
        timer = window.setTimeout(read, readEveryMs);
      };
      void read();
    }

    void start();
    return stop;
  }, []);

  async function toggleTorch() {
    const on = !torch.on;
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((current) => ({ ...current, on }));
    } catch {
      setTorch({ available: false, on: false });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') onClose();
  }

  const failed = state !== 'starting' && state !== 'scanning';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
      onKeyDown={onKeyDown}
      className="fixed inset-[0] z-50 flex flex-col bg-inverse text-on-inverse"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
        <h2 id="scanner-title" className="type-title">
          {t('title')}
        </h2>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="inline-flex size-[2.75rem] items-center justify-center rounded-pill"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={video}
          muted
          playsInline
          aria-hidden
          className={`absolute inset-[0] size-full object-cover ${state === 'scanning' ? '' : 'invisible'}`}
        />
        {!failed && (
          <div className="pointer-events-none absolute inset-[0] flex items-center justify-center p-6">
            <div className="aspect-[3/2] w-full max-w-[22rem] rounded-card border-(length:--border-ink) border-on-inverse" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-[0] flex flex-col items-start justify-center gap-4 p-6">
            <p role="alert" className="type-body">
              {t(`errors.${state}`)}
            </p>
            {state !== 'unsupported' && fallback}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <p role="status" className="type-body">
          {state === 'starting' ? t('starting') : state === 'scanning' ? (notIsbn ? t('notIsbn') : t('aim')) : ''}
        </p>
        {state === 'scanning' && torch.available && (
          <Button type="button" variant="secondary" onClick={toggleTorch} aria-pressed={torch.on}>
            {torch.on ? t('torchOff') : t('torchOn')}
          </Button>
        )}
      </div>
    </div>
  );
}
