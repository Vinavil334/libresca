import tokens from '@libresca/tokens/tokens.json' with { type: 'json' };

type Theme = 'giorno' | 'notte';

/**
 * A color token as a literal value, for the few places that cannot use CSS variables:
 * the web manifest and the browser's theme-color.
 */
export function tokenColor(name: string, theme: Theme): string {
  const token = tokens.color.tokens.find((t) => t.name === name);
  if (!token) throw new Error(`Unknown color token: ${name}`);
  return (token.value as Record<Theme, string>)[theme];
}
