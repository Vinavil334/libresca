import type { SVGProps } from 'react';

/**
 * Icons from docs/design/assets/icons, inline with `currentColor` (DESIGN_SYSTEM.md):
 * 2px stroke, 24px grid, round ends. Decorative by default; pass `aria-label` and
 * `aria-hidden={false}` when an icon stands alone.
 */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    />
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </Icon>
  );
}

export function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2 7V3h4M18 3h4v4M22 17v4h-4M6 21H2v-4" />
      <path d="M7 7v10M10.5 7v10M14 7v10M17 7v10" />
    </Icon>
  );
}

export function TanaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 21V11c0-5.5 4-9 9-9s9 3.5 9 9v10Z" />
      <path d="M8.5 21v-6a3.5 3.5 0 0 1 7 0v6" />
    </Icon>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-5 4.5-7 8-7s7 2 8 7" />
    </Icon>
  );
}

/** Status icons of the StatusPill: Dispensa, in lettura, letto, messo da parte. */
export function PantryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 3h10v18l-5-4-5 4Z" />
    </Icon>
  );
}

export function ReadingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 6C9 4 6 4 2.5 5.2v13.3C6 17.3 9 17.3 12 19c3-1.7 6-1.7 9.5-.5V5.2C18 4 15 4 12 6Zm0 0v13" />
    </Icon>
  );
}

export function ReadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function PausedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 6v12M15 6v12" />
    </Icon>
  );
}
