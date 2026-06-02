/** Compare dotted version strings (e.g. 1.0.0 vs 1.0.1). */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.trim().split('.').map((part) => parseInt(part, 10) || 0);
  const partsB = b.trim().split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

export function isVersionLessThan(current: string, minimum: string): boolean {
  return compareSemver(current, minimum) < 0;
}
