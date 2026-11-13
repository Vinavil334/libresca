'use client';

import { type ReactNode, useEffect, useRef } from 'react';

type Variant = 'sheet' | 'ticket';

const variants: Record<Variant, string> = {
  // Rises from the bottom on a phone; on wider screens it floats in the middle.
  sheet:
    'mx-[0] mb-[0] mt-auto w-full max-w-none rounded-t-sheet border-(length:--border-ink) border-border bg-surface p-5 sm:m-auto sm:max-w-lg sm:rounded-sheet transition-transform duration-(--motion-gentle) ease-gentle starting:translate-y-full',
  // A confirmation on the ticket: one entrance with `ease-pop` (DESIGN_SYSTEM.md, "Forme e movimento").
  ticket:
    'm-auto w-[calc(100%-2rem)] max-w-[22rem] rounded-card border-(length:--border-ink) border-dashed border-border bg-ticket p-5 shadow-lift transition-[transform,opacity] duration-(--motion-slow) ease-pop starting:scale-75 starting:opacity-0',
};

/**
 * A modal on the native `<dialog>`: focus stays inside, Escape and a tap outside close
 * it, and the page behind is inert. It opens when mounted, so the caller decides when it
 * exists; closing calls `onClose`, which should unmount it. Focus goes back to the
 * control that opened it when that control is still on the page. An element marked
 * `data-autofocus` takes the focus instead of the first control.
 */
export function Sheet({
  labelledBy,
  onClose,
  variant = 'sheet',
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  variant?: Variant;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    // Unmounting removes the dialog, which leaves the top layer without a `close` event.
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={() => close.current()}
      // A tap on the backdrop lands on the dialog itself, outside its box.
      onClick={(event) => {
        const dialog = ref.current;
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) dialog.close();
      }}
      className={`max-h-[92dvh] overflow-y-auto text-text backdrop:bg-shadow/50 motion-reduce:transition-none ${variants[variant]}`}
    >
      {children}
    </dialog>
  );
}
