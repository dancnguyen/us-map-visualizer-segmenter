import type { ExpressionSpecification } from 'maplibre-gl';

export interface ColorGroup {
  keys: string[];
  color: string;
}

/**
 * MapLibre expression that colors features by a property:
 *   ['match', ['get', prop], [keys of group 1], color1, [keys of group 2], color2, fallback]
 * Returns just the fallback when no group has keys.
 */
export function colorMatch(prop: string, groups: ColorGroup[], fallback: string): ExpressionSpecification | string {
  const nonEmpty = groups.filter((g) => g.keys.length > 0);
  if (nonEmpty.length === 0) return fallback;
  const branches = nonEmpty.flatMap((g) => [g.keys, g.color]);
  // TypeScript can't check a variable-length match, so cast; the shape is built above.
  return ['match', ['get', prop], ...branches, fallback] as unknown as ExpressionSpecification;
}

/** Groups keys by the value a lookup gives them, e.g. ZIP -> segment id. */
export function groupBy<V>(entries: Iterable<[string, V]>): Map<V, string[]> {
  const groups = new Map<V, string[]>();
  for (const [key, value] of entries) {
    const list = groups.get(value);
    if (list) list.push(key);
    else groups.set(value, [key]);
  }
  return groups;
}
