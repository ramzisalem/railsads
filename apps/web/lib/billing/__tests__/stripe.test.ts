import { describe, it, expect } from "vitest";
import {
  CREDIT_COSTS,
  PLAN_CREDITS,
  creditsToCreatives,
} from "../stripe";

describe("CREDIT_COSTS", () => {
  it("maps all expected service types", () => {
    expect(CREDIT_COSTS.creative_generation).toBe(15);
    expect(CREDIT_COSTS.image_generation).toBe(25);
    expect(CREDIT_COSTS.image_edit).toBe(25);
    expect(CREDIT_COSTS.icp_generation).toBe(5);
    expect(CREDIT_COSTS.competitor_analysis).toBe(10);
    expect(CREDIT_COSTS.website_import).toBe(20);
  });

  it("marks creative text revision and export as free", () => {
    expect(CREDIT_COSTS.creative_revision).toBe(0);
    expect(CREDIT_COSTS.export).toBe(0);
  });
});

describe("PLAN_CREDITS", () => {
  it("defines monthly credits for all plans", () => {
    expect(PLAN_CREDITS.starter).toBe(2500);
    expect(PLAN_CREDITS.pro).toBe(5000);
    expect(PLAN_CREDITS.enterprise).toBe(10000);
  });

  it("pro is 2x starter", () => {
    expect(PLAN_CREDITS.pro).toBe(PLAN_CREDITS.starter * 2);
  });
});

describe("creditsToCreatives", () => {
  it("converts credits to creatives using generation cost", () => {
    expect(creditsToCreatives(150)).toBe(10);
    expect(creditsToCreatives(2500)).toBe(166);
    expect(creditsToCreatives(5000)).toBe(333);
  });

  it("floors partial creatives", () => {
    expect(creditsToCreatives(16)).toBe(1);
    expect(creditsToCreatives(14)).toBe(0);
  });

  it("returns 0 for zero credits", () => {
    expect(creditsToCreatives(0)).toBe(0);
  });

  it("handles negative credits (floors toward negative infinity)", () => {
    expect(creditsToCreatives(-100)).toBe(-7);
  });
});
