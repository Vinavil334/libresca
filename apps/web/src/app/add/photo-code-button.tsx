'use client';

import type { ScannedCode } from '@libresca/domain';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Button } from '@/components/button';
import { readBookCodeFromPhoto } from '@/lib/barcode';

export type PhotoCodeResult = ScannedCode | null | 'unsupported';

/**
 * "Fotografa il codice": reads the ISBN barcode from a photo, for when the camera cannot
 * stream (permission refused, desktop without a camera, an old browser).
 */
export function PhotoCodeButton({
  onResult,
  variant = 'secondary',
}: {
  onResult: (result: PhotoCodeResult) => void;
  variant?: 'secondary' | 'quiet';
}) {
  const t = useTranslations('add.scan');
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function read(file: File | undefined) {
    if (!file) return;
    setReading(true);
    const result = await readBookCodeFromPhoto(file);
    setReading(false);
    onResult(result);
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(event) => {
          void read(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant={variant}
        disabled={reading}
        onClick={() => input.current?.click()}
        className={variant === 'quiet' ? 'self-start' : ''}
      >
        {reading ? t('reading') : t('photo')}
      </Button>
    </>
  );
}
