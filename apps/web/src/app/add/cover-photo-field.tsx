'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Button } from '@/components/button';
import { resizeCoverPhoto } from '@/lib/resize-cover';

import { discardCover, uploadCover } from './actions';

export interface CoverPhoto {
  path: string;
  url: string;
}

type PhotoFailure = 'invalid' | 'too_large' | 'failed';

/**
 * "Usa una tua foto": opens the camera or the gallery (the phone asks which), resizes the
 * photo in the browser and uploads it at once, so saving the card stays instant. A photo
 * replaced or removed before saving is deleted from storage.
 */
export function CoverPhotoField({
  photo,
  onChange,
}: {
  photo: CoverPhoto | null;
  onChange: (photo: CoverPhoto | null) => void;
}) {
  const t = useTranslations('add.confirm.photo');
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<PhotoFailure | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setFailure(null);
    const resized = await resizeCoverPhoto(file);
    if (!resized) {
      setUploading(false);
      return setFailure('invalid');
    }
    const form = new FormData();
    form.append('photo', new File([resized], 'cover.jpg', { type: 'image/jpeg' }));
    const result = await uploadCover(form).catch(() => ({ ok: false as const, reason: 'failed' as const }));
    setUploading(false);
    if (!result.ok) return setFailure(result.reason);
    if (photo) void discardCover(photo.path);
    onChange({ path: result.path, url: result.url });
  }

  function remove() {
    if (photo) void discardCover(photo.path);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Button type="button" variant="secondary" disabled={uploading} onClick={() => input.current?.click()}>
        {photo ? t('change') : t('add')}
      </Button>
      {photo && (
        <Button type="button" variant="quiet" disabled={uploading} onClick={remove} className="self-start">
          {t('remove')}
        </Button>
      )}
      <p role="status" className="type-small text-text-muted">
        {uploading ? t('uploading') : photo ? t('ready') : t('hint')}
      </p>
      {failure && (
        <p role="alert" className="type-small text-danger">
          {t(`errors.${failure}`)}
        </p>
      )}
    </div>
  );
}
