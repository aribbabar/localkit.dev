import { describe, expect, it } from "vitest";
import {
  annualToHourly,
  comparePayBreakdowns,
  derivePayBreakdown,
  hourlyToAnnual,
  normalizeNumericInput,
} from "../src/lib/pay";

describe("pay calculations", () => {
  it("converts hourly pay to annual pay with standard full-time assumptions", () => {
    expect(hourlyToAnnual(25, 40, 52)).toBe(52000);
  });

  it("converts annual pay to hourly pay with custom schedules", () => {
    expect(annualToHourly(26000, 20, 52)).toBe(25);
    expect(annualToHourly(80000, 40, 50)).toBe(40);
  });

  it("includes overtime when deriving annual and hourly pay", () => {
    const annual = hourlyToAnnual(30, 40, 52, 5, 1.5);
    expect(annual).toBe(74100);

    const hourly = annualToHourly(74100, 40, 52, 5, 1.5);
    expect(hourly).toBe(30);
  });

  it("derives pay breakdown cards from annual salary inputs", () => {
    const breakdown = derivePayBreakdown({
      inputMode: "annual",
      amount: 78000,
      hoursPerWeek: 37.5,
      weeksPerYear: 52,
    });

    expect(breakdown).toEqual({
      annual: 78000,
      hourly: 40,
      weekly: 1500,
      biweekly: 3000,
      monthly: 6500,
      weightedHoursPerWeek: 37.5,
      annualWeightedHours: 1950,
    });
  });

  it("compares two pay scenarios from scenario b against scenario a", () => {
    const scenarioA = derivePayBreakdown({
      inputMode: "annual",
      amount: 60000,
      hoursPerWeek: 40,
      weeksPerYear: 52,
    });
    const scenarioB = derivePayBreakdown({
      inputMode: "hourly",
      amount: 35,
      hoursPerWeek: 40,
      weeksPerYear: 52,
    });

    expect(scenarioA).not.toBeNull();
    expect(scenarioB).not.toBeNull();

    const comparison = comparePayBreakdowns(scenarioA!, scenarioB!);
    expect(comparison.higherScenario).toBe("b");
    expect(comparison.annualDifference).toBe(12800);
    expect(comparison.hourlyDifference).toBeCloseTo(6.1538461538);
    expect(comparison.percentAnnualDifference).toBeCloseTo(21.3333333333);
  });

  it("normalizes numeric text while rejecting invalid or negative input", () => {
    expect(normalizeNumericInput("$60,000")).toBe(60000);
    expect(normalizeNumericInput(" 31.25 ")).toBe(31.25);
    expect(normalizeNumericInput("")).toBeNull();
    expect(normalizeNumericInput("-5")).toBeNull();
    expect(normalizeNumericInput("abc")).toBeNull();
  });
});
