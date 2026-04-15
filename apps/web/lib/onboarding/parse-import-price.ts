/** Normalize comma/dot so parseFloat works (US vs EU-style numbers). */
function normalizeNumberSeparators(raw: string): string {
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma > lastDot) {
    return raw.replace(/\./g, "").replace(",", ".");
  }
  return raw.replace(/,/g, "");
}

/**
 * Best-effort parse of human-readable import prices into DB fields.
 * Falls back to null amount when no number is found; preserves currency hints.
 */
export function parseImportPrice(
  priceText: string | null | undefined,
  currencyHint: string | null | undefined
): { price_amount: number | null; price_currency: string } {
  const hint = currencyHint?.trim().toUpperCase().slice(0, 3);
  const defaultCurr =
    hint && /^[A-Z]{3}$/.test(hint) ? hint : "USD";

  if (!priceText?.trim()) {
    return { price_amount: null, price_currency: defaultCurr };
  }

  const t = priceText.trim();
  let currency = defaultCurr;
  if (/£/.test(t)) currency = "GBP";
  else if (/€/.test(t)) currency = "EUR";
  else if (/\$/.test(t)) currency = "USD";
  else {
    const code = t.match(/\b(AUD|CAD|NZD|CHF|JPY|EUR|GBP|USD|INR|SEK|NOK|DKK|PLN)\b/i);
    if (code) currency = code[1].toUpperCase();
  }

  const digitChunk = t.replace(/[^\d.,]/g, "");
  const normalized = normalizeNumberSeparators(digitChunk);
  const numMatch = normalized.match(/(\d+(?:\.\d{1,4})?)/);
  if (!numMatch) {
    return { price_amount: null, price_currency: currency };
  }
  const n = parseFloat(numMatch[1]);
  if (!Number.isFinite(n)) {
    return { price_amount: null, price_currency: currency };
  }
  return { price_amount: n, price_currency: currency };
}
