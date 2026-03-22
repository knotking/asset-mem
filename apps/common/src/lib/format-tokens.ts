const nf = new Intl.NumberFormat("en-US");

/** Short token counts for UI (e.g. 1.2K, 3.4M). */
export function formatTokensCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const neg = value < 0 ? "-" : "";
  if (abs < 1000) {
    return neg + nf.format(Math.round(abs));
  }
  if (abs < 1_000_000) {
    const k = abs / 1000;
    const s = k >= 100 ? String(Math.round(k)) : k.toFixed(1).replace(/\.0$/, "");
    return `${neg}${s}K`;
  }
  const m = abs / 1_000_000;
  const s = m >= 100 ? String(Math.round(m)) : m.toFixed(1).replace(/\.0$/, "");
  return `${neg}${s}M`;
}

export function formatTokensFull(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return nf.format(Math.round(value));
}
