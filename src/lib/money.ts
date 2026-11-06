// Exact money helpers. All arithmetic is in integer cents (BigInt where a
// rate or fractional quantity is involved) so results match Postgres
// `round(numeric, 2)` exactly. No floating-point money anywhere.

export type Cents = number;

const RATE_SCALE = 100_000_000n; // exchange rates have 8 decimal places
const QTY_SCALE = 1_000n; // quantities have 3 decimal places

/** Parse a decimal (number or numeric string from Postgres) into a scaled BigInt. */
export function toScaled(value: number | string, decimals: number): bigint {
  const raw = typeof value === "number" ? value.toFixed(Math.min(decimals + 2, 20)) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Not a decimal: ${value}`);
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");
  const padded = (frac + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  // half-up rounding on the extra digit
  let n = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded.slice(0, decimals) || "0");
  if (Number(padded[decimals]) >= 5) n += 1n;
  return negative ? -n : n;
}

export function toCents(value: number | string | null | undefined): Cents | null {
  if (value === null || value === undefined || value === "") return null;
  return Number(toScaled(value, 2));
}

function divRoundHalfUp(n: bigint, d: bigint): bigint {
  const neg = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = (an * 2n + ad) / (ad * 2n);
  return neg ? -q : q;
}

/**
 * round((unitCents * qty + extraCents) * rate) in cents — identical to the SQL
 * `round((price * quantity + other_charges) * rate, 2)` used when approving.
 */
export function convertCents(
  unitCents: Cents,
  rate: number | string,
  qty: number | string = 1,
  extraCents: Cents = 0,
): Cents {
  const r = toScaled(rate, 8);
  const q = toScaled(qty, 3);
  const amountScaled = BigInt(unitCents) * q + BigInt(extraCents) * QTY_SCALE; // cents × 1000
  return Number(divRoundHalfUp(amountScaled * r, QTY_SCALE * RATE_SCALE));
}

export function centsToNumber(c: Cents): number {
  return c / 100;
}

/** "S$1,234.50" style formatting. */
export function formatMoney(c: Cents | null | undefined, currency = "SGD", opts: { compact?: boolean } = {}): string {
  if (c === null || c === undefined) return "—";
  const symbol = currency === "SGD" ? "S$" : currency === "CNY" ? "¥" : currency === "USD" ? "US$" : `${currency} `;
  const abs = Math.abs(c) / 100;
  const fractionDigits = opts.compact && Number.isInteger(abs) ? 0 : 2;
  const s = abs.toLocaleString("en-SG", { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 });
  return `${c < 0 ? "−" : ""}${symbol}${s}`;
}

/**
 * Split `total` cents across weights so the parts always add up to exactly
 * `total` (largest-remainder method). Zero/empty weights split equally.
 */
export function allocateCents(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) return [];
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const eff = sum > 0 ? w : w.map(() => 1);
  const effSum = sum > 0 ? sum : w.length;
  const exact = eff.map((x) => (total * x) / effSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) floors[order[k].i] += 1;
  return floors;
}

export const RATE_SCALE_DIGITS = 8;
export { RATE_SCALE, QTY_SCALE };
