/** pluralize(1, 'city', 'cities') -> "1 city"; pluralize(2400, 'ZIP') -> "2,400 ZIPs" */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}
