import type { ReadingStatus } from '@libresca/domain';
import { useTranslations } from 'next-intl';

import { PantryIcon, PausedIcon, ReadIcon, ReadingIcon } from './icons';

const styles: Record<ReadingStatus, string> = {
  want: 'border-border bg-surface-raised text-text',
  reading: 'border-border bg-honey text-on-honey',
  read: 'border-border bg-canopy-soft text-text',
  // "Messo da parte": grey outline and two bars, never a judgement (SCHERMATE_TANA.md).
  abandoned: 'border-text-muted bg-surface text-text-muted',
};

const icons = { want: PantryIcon, reading: ReadingIcon, read: ReadIcon, abandoned: PausedIcon };

/**
 * The status of a reading as shape, icon and word (DESIGN_SYSTEM.md, StatusPill).
 * `readCount` turns "Letto" into "Letto 2 volte" when a book was finished more than once.
 */
export function StatusPill({ status, readCount = 0 }: { status: ReadingStatus; readCount?: number }) {
  const t = useTranslations('statusPill');
  const Icon = icons[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border-(length:--border-ink) py-1 pr-3 pl-2 type-small ${styles[status]}`}
    >
      <Icon width={16} height={16} />
      {status === 'read' && readCount > 1 ? t('readTimes', { count: readCount }) : t(status)}
    </span>
  );
}
