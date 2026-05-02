import {
  annualToHourly,
  hourlyToAnnual,
  normalizeNumericInput,
  type PayInputMode,
} from "../../lib/pay";

export const PAY_CALCULATOR_PREFERENCES_KEY = "localkit:pay-calculator";

export interface PayCalculatorScenarioPreferences {
  annualPay: string;
  hourlyPay: string;
  hoursPerWeek: string;
  weeksPerYear: string;
  overtimeEnabled: boolean;
  overtimeHoursPerWeek: string;
  overtimeMultiplier: string;
  lastEdited: PayInputMode;
}

export interface PayCalculatorPreferences {
  compareMode: boolean;
  scenarioA: PayCalculatorScenarioPreferences;
  scenarioB: PayCalculatorScenarioPreferences;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function formatStoredNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function sanitizeNumericString(
  value: unknown,
  fallback: string,
  options: {
    allowEmpty?: boolean;
    invalidAsEmpty?: boolean;
    min?: number;
    minExclusive?: number;
  } = {},
) {
  if (typeof value === "string" && !value.trim()) {
    return options.allowEmpty ? "" : fallback;
  }

  const parsed = normalizeNumericInput(value);
  if (parsed === null) return options.invalidAsEmpty ? "" : fallback;
  if (options.min !== undefined && parsed < options.min) return fallback;
  if (options.minExclusive !== undefined && parsed <= options.minExclusive) {
    return fallback;
  }
  return formatStoredNumber(parsed);
}

function sanitizeInputMode(
  value: unknown,
  fallback: PayInputMode,
): PayInputMode {
  return value === "hourly" || value === "annual" ? value : fallback;
}

function buildDefaultScenario(): PayCalculatorScenarioPreferences {
  return {
    annualPay: "60000",
    hourlyPay: formatStoredNumber(annualToHourly(60000, 40, 52)),
    hoursPerWeek: "40",
    weeksPerYear: "52",
    overtimeEnabled: false,
    overtimeHoursPerWeek: "0",
    overtimeMultiplier: "1.5",
    lastEdited: "annual",
  };
}

export const DEFAULT_PAY_CALCULATOR_PREFERENCES: PayCalculatorPreferences = {
  compareMode: false,
  scenarioA: buildDefaultScenario(),
  scenarioB: buildDefaultScenario(),
};

function reconcileScenario(
  scenario: PayCalculatorScenarioPreferences,
): PayCalculatorScenarioPreferences {
  const annualPay = normalizeNumericInput(scenario.annualPay);
  const hourlyPay = normalizeNumericInput(scenario.hourlyPay);
  const hoursPerWeek = normalizeNumericInput(scenario.hoursPerWeek);
  const weeksPerYear = normalizeNumericInput(scenario.weeksPerYear);
  const overtimeHoursPerWeek = normalizeNumericInput(
    scenario.overtimeHoursPerWeek,
  );
  const overtimeMultiplier = normalizeNumericInput(scenario.overtimeMultiplier);

  let lastEdited = scenario.lastEdited;
  if (lastEdited === "annual" && annualPay === null && hourlyPay !== null) {
    lastEdited = "hourly";
  } else if (
    lastEdited === "hourly" &&
    hourlyPay === null &&
    annualPay !== null
  ) {
    lastEdited = "annual";
  }

  const canConvert =
    hoursPerWeek !== null &&
    hoursPerWeek > 0 &&
    weeksPerYear !== null &&
    weeksPerYear > 0 &&
    (!scenario.overtimeEnabled ||
      (overtimeHoursPerWeek !== null &&
        overtimeMultiplier !== null &&
        overtimeMultiplier >= 1));

  let nextAnnualPay = scenario.annualPay;
  let nextHourlyPay = scenario.hourlyPay;

  if (canConvert) {
    const resolvedOvertimeHours = scenario.overtimeEnabled
      ? (overtimeHoursPerWeek ?? 0)
      : 0;
    const resolvedOvertimeMultiplier = scenario.overtimeEnabled
      ? (overtimeMultiplier ?? 1.5)
      : 1.5;

    if (lastEdited === "annual" && annualPay !== null) {
      nextHourlyPay = formatStoredNumber(
        annualToHourly(
          annualPay,
          hoursPerWeek,
          weeksPerYear,
          resolvedOvertimeHours,
          resolvedOvertimeMultiplier,
        ),
      );
    } else if (lastEdited === "hourly" && hourlyPay !== null) {
      nextAnnualPay = formatStoredNumber(
        hourlyToAnnual(
          hourlyPay,
          hoursPerWeek,
          weeksPerYear,
          resolvedOvertimeHours,
          resolvedOvertimeMultiplier,
        ),
      );
    }
  }

  return {
    ...scenario,
    annualPay: nextAnnualPay,
    hourlyPay: nextHourlyPay,
    lastEdited,
  };
}

function sanitizeScenario(
  value: unknown,
  fallback: PayCalculatorScenarioPreferences,
): PayCalculatorScenarioPreferences {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const candidate = value as Partial<PayCalculatorScenarioPreferences>;

  return reconcileScenario({
    annualPay: sanitizeNumericString(candidate.annualPay, fallback.annualPay, {
      allowEmpty: true,
      invalidAsEmpty: true,
      min: 0,
    }),
    hourlyPay: sanitizeNumericString(candidate.hourlyPay, fallback.hourlyPay, {
      allowEmpty: true,
      invalidAsEmpty: true,
      min: 0,
    }),
    hoursPerWeek: sanitizeNumericString(
      candidate.hoursPerWeek,
      fallback.hoursPerWeek,
      { allowEmpty: true, minExclusive: 0 },
    ),
    weeksPerYear: sanitizeNumericString(
      candidate.weeksPerYear,
      fallback.weeksPerYear,
      { allowEmpty: true, minExclusive: 0 },
    ),
    overtimeEnabled:
      typeof candidate.overtimeEnabled === "boolean"
        ? candidate.overtimeEnabled
        : fallback.overtimeEnabled,
    overtimeHoursPerWeek: sanitizeNumericString(
      candidate.overtimeHoursPerWeek,
      fallback.overtimeHoursPerWeek,
      { allowEmpty: true, min: 0 },
    ),
    overtimeMultiplier: sanitizeNumericString(
      candidate.overtimeMultiplier,
      fallback.overtimeMultiplier,
      { allowEmpty: true, min: 1 },
    ),
    lastEdited: sanitizeInputMode(candidate.lastEdited, fallback.lastEdited),
  });
}

export function sanitizePayCalculatorPreferences(
  value: unknown,
): PayCalculatorPreferences {
  if (!value || typeof value !== "object") {
    return {
      compareMode: DEFAULT_PAY_CALCULATOR_PREFERENCES.compareMode,
      scenarioA: { ...DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioA },
      scenarioB: { ...DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioB },
    };
  }

  const candidate = value as Partial<PayCalculatorPreferences>;

  return {
    compareMode:
      typeof candidate.compareMode === "boolean"
        ? candidate.compareMode
        : DEFAULT_PAY_CALCULATOR_PREFERENCES.compareMode,
    scenarioA: sanitizeScenario(
      candidate.scenarioA,
      DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioA,
    ),
    scenarioB: sanitizeScenario(
      candidate.scenarioB,
      DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioB,
    ),
  };
}

export function loadPayCalculatorPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): PayCalculatorPreferences {
  try {
    const raw = storage?.getItem(PAY_CALCULATOR_PREFERENCES_KEY);
    if (!raw) {
      return sanitizePayCalculatorPreferences(undefined);
    }

    return sanitizePayCalculatorPreferences(JSON.parse(raw));
  } catch {
    return sanitizePayCalculatorPreferences(undefined);
  }
}

export function savePayCalculatorPreferences(
  preferences: PayCalculatorPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      PAY_CALCULATOR_PREFERENCES_KEY,
      JSON.stringify(sanitizePayCalculatorPreferences(preferences)),
    );
  } catch {
    // Storage may be unavailable or full.
  }
}
