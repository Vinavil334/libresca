import type { ContributorRole } from '@libresca/domain';

import { matchKey } from './text';

/**
 * Contributor role from a free-text label, in Italian or English:
 * "traduzione", "translated by", "a cura di", "illustrazioni", "introduzione"…
 * Returns undefined when the label names no known role.
 */
export function roleFromLabel(label: string): ContributorRole | undefined {
  const key = matchKey(label);
  if (/tradu|translat|ubersetz/.test(key)) return 'translator';
  if (/\bcura\b|curat|editor|edited/.test(key)) return 'editor';
  if (/illustr/.test(key)) return 'illustrator';
  if (/introdu|prefa|presentazione|foreword|preface/.test(key)) return 'introduction';
  if (/postfa|afterword|note|commento/.test(key)) return 'other';
  return undefined;
}
