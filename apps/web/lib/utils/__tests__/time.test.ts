import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo } from "../time";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setNow(date: Date) {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  }

  const BASE = new Date("2026-04-15T12:00:00Z");

  it('returns "just now" for less than a minute', () => {
    setNow(new Date(BASE.getTime() + 30_000));
    expect(timeAgo(BASE.toISOString())).toBe("just now");
  });

  it("returns minutes for less than an hour", () => {
    setNow(new Date(BASE.getTime() + 5 * 60_000));
    expect(timeAgo(BASE.toISOString())).toBe("5m ago");
  });

  it("returns hours for less than a day", () => {
    setNow(new Date(BASE.getTime() + 3 * 3_600_000));
    expect(timeAgo(BASE.toISOString())).toBe("3h ago");
  });

  it('returns "yesterday" for 1 day', () => {
    setNow(new Date(BASE.getTime() + 24 * 3_600_000));
    expect(timeAgo(BASE.toISOString())).toBe("yesterday");
  });

  it("returns days for more than 1 day", () => {
    setNow(new Date(BASE.getTime() + 5 * 24 * 3_600_000));
    expect(timeAgo(BASE.toISOString())).toBe("5d ago");
  });
});
