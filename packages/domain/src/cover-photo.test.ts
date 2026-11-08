import { describe, expect, it } from 'vitest';

import { coverPhotoPath, coverPhotoSize, coverPhotoUrl, isCoverPath } from './cover-photo';

const account = '11111111-1111-1111-1111-111111111111';
const file = 'AAAAAAAA-0000-4000-8000-000000000001';

describe('coverPhotoPath', () => {
  it('puts the photo in the account folder with a uuid name', () => {
    const path = coverPhotoPath(account, file);
    expect(path).toBe(`${account}/aaaaaaaa-0000-4000-8000-000000000001.jpg`);
    expect(path && isCoverPath(path)).toBe(true);
  });

  it('refuses ids that are not uuids', () => {
    expect(coverPhotoPath('../etc', file)).toBeNull();
    expect(coverPhotoPath(account, 'copertina')).toBeNull();
    expect(isCoverPath(`${account}/x.png`)).toBe(false);
    expect(isCoverPath(`${account}/aaaaaaaa-0000-4000-8000-000000000001xjpg`)).toBe(false);
  });
});

describe('coverPhotoSize', () => {
  it('shrinks the longest side and keeps the proportions', () => {
    expect(coverPhotoSize(3024, 4032)).toEqual({ width: 600, height: 800 });
    expect(coverPhotoSize(4000, 3000)).toEqual({ width: 800, height: 600 });
  });

  it('never enlarges a small photo', () => {
    expect(coverPhotoSize(300, 450)).toEqual({ width: 300, height: 450 });
  });

  it('refuses a picture without a size', () => {
    expect(coverPhotoSize(0, 100)).toBeNull();
    expect(coverPhotoSize(Number.NaN, 100)).toBeNull();
  });
});

describe('coverPhotoUrl', () => {
  it('points to the public bucket', () => {
    expect(coverPhotoUrl('http://127.0.0.1:54321/', `${account}/f.jpg`)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/covers/${account}/f.jpg`,
    );
  });
});
