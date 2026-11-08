import type { JsonValue } from '@libresca/domain';

/** Safe readers for JSON of unknown shape: external APIs change without notice. */
export type JsonObject = Record<string, unknown>;

export function asObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asStrings(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

/** Open Library writes long text either as a string or as `{ type: '/type/text', value }`. */
export function textValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  const nested = asObject(value).value;
  return typeof nested === 'string' ? nested : undefined;
}

/** A copy without the given keys, typed as JSON for storage. */
export function without(value: JsonObject, keys: string[]): JsonValue {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as JsonValue;
}

/** The last segment of an Open Library key: "/authors/OL22242A" gives "OL22242A". */
export function keyId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.split('/').pop();
  return id || undefined;
}
