'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { buttonClasses } from './button';
import { ScanIcon, TanaIcon, UserIcon } from './icons';

const tab =
  'flex min-h-[3.5rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-card px-2 type-nav text-text-muted aria-[current=page]:text-text lg:min-h-[2.75rem] lg:flex-row lg:gap-2';

/**
 * The navigation (DESIGN_SYSTEM.md, NavBar): at the bottom on a phone, at the top on
 * desktop with "Aggiungi un libro". Until Bosco and Micelio exist (F2, F3) it has Tana,
 * Scansiona and Tu.
 */
export function NavBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const inTana = pathname === '/' || pathname.startsWith('/books') || pathname.startsWith('/shelves');
  const current = (active: boolean) => (active ? ('page' as const) : undefined);

  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-[0] bottom-[0] z-10 border-t-(length:--border-ink) border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:static lg:border-t-[0] lg:border-b-(length:--border-ink) lg:pb-[0]"
    >
      <ul className="mx-auto flex max-w-5xl items-center justify-around px-4 py-1 sm:px-6 lg:justify-start lg:gap-2">
        <li className="hidden lg:mr-4 lg:block">
          <span className="type-title text-text">{t('brand')}</span>
        </li>
        <li>
          <Link href="/" aria-current={current(inTana)} className={tab}>
            <TanaIcon />
            {t('tana')}
          </Link>
        </li>
        <li className="lg:hidden">
          <Link href="/add?scan=1" className={tab}>
            <span className="grid size-[2.75rem] place-items-center rounded-pill border-(length:--border-ink) border-border bg-accent text-on-accent shadow-card">
              <ScanIcon />
            </span>
            {t('scan')}
          </Link>
        </li>
        <li>
          <Link href="/me" aria-current={current(pathname === '/me')} className={tab}>
            <UserIcon />
            {t('me')}
          </Link>
        </li>
        <li className="hidden lg:ml-auto lg:block">
          <Link href="/add" className={buttonClasses('primary', 'min-h-[2.75rem]')}>
            {t('add')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** A page of the app with the navigation: room at the bottom on a phone for the bar. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[6rem] lg:pb-[0]">
      <NavBar />
      {children}
    </div>
  );
}
