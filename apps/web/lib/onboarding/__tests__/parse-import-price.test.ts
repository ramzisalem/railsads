import { describe, it, expect } from "vitest";
import { parseImportPrice } from "../parse-import-price";

describe("parseImportPrice", () => {
  it("parses USD from $ prefix", () => {
    expect(parseImportPrice("$99.00", null)).toEqual({
      price_amount: 99,
      price_currency: "USD",
    });
  });

  it("parses US thousands separator", () => {
    expect(parseImportPrice("$1,299.00", null)).toEqual({
      price_amount: 1299,
      price_currency: "USD",
    });
  });

  it("uses EUR for €", () => {
    expect(parseImportPrice("€49,50", null)).toEqual({
      price_amount: 49.5,
      price_currency: "EUR",
    });
  });

  it("respects explicit currency code in text", () => {
    expect(parseImportPrice("99.00 CAD", "USD")).toEqual({
      price_amount: 99,
      price_currency: "CAD",
    });
  });

  it("returns null amount for empty text", () => {
    expect(parseImportPrice(null, "EUR")).toEqual({
      price_amount: null,
      price_currency: "EUR",
    });
  });
});
