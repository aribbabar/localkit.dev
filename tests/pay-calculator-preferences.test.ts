import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PAY_CALCULATOR_PREFERENCES,
  PAY_CALCULATOR_PREFERENCES_KEY,
  loadPayCalculatorPreferences,
  savePayCalculatorPreferences,
  sanitizePayCalculatorPreferences,
} from "../src/components/pay-calculator/preferences";

describe("pay calculator preferences", () => {
  it("loads saved preferences from storage", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          compareMode: true,
          scenarioA: {
            annualPay: "90000",
            hourlyPay: "43.27",
            hoursPerWeek: "40",
            weeksPerYear: "52",
            overtimeEnabled: false,
            overtimeHoursPerWeek: "0",
            overtimeMultiplier: "1.5",
            lastEdited: "annual",
          },
          scenarioB: {
            annualPay: "70000",
            hourlyPay: "33.65",
            hoursPerWeek: "35",
            weeksPerYear: "50",
            overtimeEnabled: true,
            overtimeHoursPerWeek: "5",
            overtimeMultiplier: "2",
            lastEdited: "hourly",
          },
        }),
      ),
      setItem: vi.fn(),
    };

    const loaded = loadPayCalculatorPreferences(storage);
    expect(loaded.compareMode).toBe(true);
    expect(loaded.scenarioB.overtimeEnabled).toBe(true);
    expect(loaded.scenarioB.overtimeMultiplier).toBe("2");
    expect(loaded.scenarioB.lastEdited).toBe("hourly");
  });

  it("falls back to defaults for malformed storage data", () => {
    const storage = {
      getItem: vi.fn(() => "{not-json"),
      setItem: vi.fn(),
    };

    expect(loadPayCalculatorPreferences(storage)).toEqual(
      DEFAULT_PAY_CALCULATOR_PREFERENCES,
    );
  });

  it("sanitizes invalid values and preserves empty editable fields", () => {
    expect(
      sanitizePayCalculatorPreferences({
        compareMode: "yes",
        scenarioA: {
          annualPay: " $72,000 ",
          hourlyPay: "",
          hoursPerWeek: "0",
          weeksPerYear: -1,
          overtimeEnabled: "no",
          overtimeHoursPerWeek: "-3",
          overtimeMultiplier: "0.5",
          lastEdited: "monthly",
        },
      }),
    ).toEqual({
      compareMode: false,
      scenarioA: {
        annualPay: "72000",
        hourlyPay: "34.62",
        hoursPerWeek: "40",
        weeksPerYear: "52",
        overtimeEnabled: false,
        overtimeHoursPerWeek: "0",
        overtimeMultiplier: "1.5",
        lastEdited: "annual",
      },
      scenarioB: DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioB,
    });
  });

  it("saves normalized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    savePayCalculatorPreferences(
      {
        compareMode: true,
        scenarioA: {
          annualPay: " 85000 ",
          hourlyPay: "40.865384615",
          hoursPerWeek: "40",
          weeksPerYear: "52",
          overtimeEnabled: false,
          overtimeHoursPerWeek: "0",
          overtimeMultiplier: "1.5",
          lastEdited: "annual",
        },
        scenarioB: {
          annualPay: "52000",
          hourlyPay: " -1 ",
          hoursPerWeek: "20",
          weeksPerYear: "52",
          overtimeEnabled: true,
          overtimeHoursPerWeek: " 3 ",
          overtimeMultiplier: " 2 ",
          lastEdited: "hourly",
        },
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      PAY_CALCULATOR_PREFERENCES_KEY,
      JSON.stringify({
        compareMode: true,
        scenarioA: {
          annualPay: "85000",
          hourlyPay: "40.87",
          hoursPerWeek: "40",
          weeksPerYear: "52",
          overtimeEnabled: false,
          overtimeHoursPerWeek: "0",
          overtimeMultiplier: "1.5",
          lastEdited: "annual",
        },
        scenarioB: {
          annualPay: "52000",
          hourlyPay: "38.46",
          hoursPerWeek: "20",
          weeksPerYear: "52",
          overtimeEnabled: true,
          overtimeHoursPerWeek: "3",
          overtimeMultiplier: "2",
          lastEdited: "annual",
        },
      }),
    );
  });
});
