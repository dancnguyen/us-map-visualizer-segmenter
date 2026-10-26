export interface ColorGroup {
  keys: string[];
  color: string;
}

/** Flattens color groups into area key -> color. A key in two groups keeps the first color. */
export function colorMap(groups: ColorGroup[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const { keys, color } of groups) {
    for (const key of keys) if (!colors.has(key)) colors.set(key, color);
  }
  return colors;
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
