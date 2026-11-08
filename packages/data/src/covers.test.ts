import { describe, expect, it, vi } from 'vitest';

import type { LibrescaClient } from './client';
import { deleteCoverPhoto, uploadCoverPhoto } from './covers';

const account = '11111111-1111-1111-1111-111111111111';
const file = 'aaaaaaaa-0000-4000-8000-000000000001';
const path = `${account}/${file}.jpg`;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function fakeStorage(result: { data?: unknown; error: unknown }) {
  const bucket = { upload: vi.fn(async () => result), remove: vi.fn(async () => result) };
  const from = vi.fn(() => bucket);
  return { client: { storage: { from } } as unknown as LibrescaClient, bucket, from };
}

describe('uploadCoverPhoto', () => {
  it('uploads a JPEG into the account folder, never overwriting', async () => {
    const { client, bucket, from } = fakeStorage({ data: { path }, error: null });
    expect(await uploadCoverPhoto(client, account, file, jpeg)).toEqual({ ok: true, path });
    expect(from).toHaveBeenCalledWith('covers');
    expect(bucket.upload).toHaveBeenCalledWith(
      path,
      jpeg,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
  });

  it('refuses bad ids, non-JPEG bytes and oversized files before calling storage', async () => {
    const { client, bucket } = fakeStorage({ error: null });
    expect(await uploadCoverPhoto(client, 'nope', file, jpeg)).toEqual({ ok: false, reason: 'invalid' });
    expect(await uploadCoverPhoto(client, account, file, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set(jpeg);
    expect(await uploadCoverPhoto(client, account, file, big)).toEqual({ ok: false, reason: 'too_large' });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('reports a refused upload', async () => {
    const { client } = fakeStorage({ error: { message: 'new row violates row-level security policy' } });
    expect(await uploadCoverPhoto(client, account, file, jpeg.buffer)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('deleteCoverPhoto', () => {
  it('removes a cover path and says whether it went', async () => {
    const removed = fakeStorage({ data: [{ name: path }], error: null });
    expect(await deleteCoverPhoto(removed.client, path)).toBe(true);
    expect(removed.bucket.remove).toHaveBeenCalledWith([path]);

    const kept = fakeStorage({ data: [], error: null });
    expect(await deleteCoverPhoto(kept.client, path)).toBe(false);
  });

  it('ignores anything that is not a cover path', async () => {
    const { client, bucket } = fakeStorage({ data: [], error: null });
    expect(await deleteCoverPhoto(client, '../other/file.jpg')).toBe(false);
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});
