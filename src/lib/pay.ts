export type PayInputMode = "annual" | "hourly";

export interface PayScenario {
  inputMode: PayInputMode;
  amount: number;
  hoursPerWeek: number;
  weeksPerYear: number;
  overtimeEnabled?: boolean;
  overtimeHoursPerWeek?: number;
  overtimeMultiplier?: number;
}

export interface PayBreakdown {
  annual: number;
  hourly: number;
  weekly: number;
  biweekly: number;
  monthly: number;
  weightedHoursPerWeek: number;
  annualWeightedHours: number;
}

export interface PayComparison {
  annualDifference: number;
  hourlyDifference: number;
  weeklyDifference: number;
  biweeklyDifference: number;
  monthlyDifference: number;
  percentAnnualDifference: number | null;
  higherScenario: "a" | "b" | "equal";
}

function resolveOvertime(
  overtimeEnabled: boolean | undefined,
  overtimeHoursPerWeek: number | undefined,
  overtimeMultiplier: number | undefined,
) {
  const hours = overtimeEnabled ? overtimeHoursPerWeek ?? 0 : 0;
  const multiplier = overtimeEnabled ? overtimeMultiplier ?? 1.5 : 1.5;
  return { hours, multiplier };
}

function hasValidNumber(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function hasValidPositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0;
}

function getAnnualWeightedHours(input: PayScenario): number | null {
  if (!hasValidNumber(input.amount)) return null;
  if (!hasValidPositiveNumber(input.hoursPerWeek)) return null;
  if (!hasValidPositiveNumber(input.weeksPerYear)) return null;

  const overtime = resolveOvertime(
    input.overtimeEnabled,
    input.overtimeHoursPerWeek,
    input.overtimeMultiplier,
  );

  if (!hasValidNumber(overtime.hours)) return null;
  if (!hasValidPositiveNumber(overtime.multiplier) || overtime.multiplier < 1) {
    return null;
  }

  const weightedHoursPerWeek =
    input.hoursPerWeek + overtime.hours * overtime.multiplier;
  if (!hasValidPositiveNumber(weightedHoursPerWeek)) return null;

  return weightedHoursPerWeek * input.weeksPerYear;
}

export function normalizeNumericInput(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/[$,\s]/g, "");
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function hourlyToAnnual(
  hourly: number,
  hoursPerWeek: number,
  weeksPerYear: number,
  overtimeHoursPerWeek = 0,
  overtimeMultiplier = 1.5,
) {
  const annualWeightedHours = getAnnualWeightedHours({
    inputMode: "hourly",
    amount: hourly,
    hoursPerWeek,
    weeksPerYear,
    overtimeEnabled: overtimeHoursPerWeek > 0,
    overtimeHoursPerWeek,
    overtimeMultiplier,
  });

  if (annualWeightedHours === null) return Number.NaN;
  return hourly * annualWeightedHours;
}

export function annualToHourly(
  annual: number,
  hoursPerWeek: number,
  weeksPerYear: number,
  overtimeHoursPerWeek = 0,
  overtimeMultiplier = 1.5,
) {
  const annualWeightedHours = getAnnualWeightedHours({
    inputMode: "annual",
    amount: annual,
    hoursPerWeek,
    weeksPerYear,
    overtimeEnabled: overtimeHoursPerWeek > 0,
    overtimeHoursPerWeek,
    overtimeMultiplier,
  });

  if (annualWeightedHours === null) return Number.NaN;
  return annual / annualWeightedHours;
}

export function derivePayBreakdown(input: PayScenario): PayBreakdown | null {
  const annualWeightedHours = getAnnualWeightedHours(input);
  if (annualWeightedHours === null) return null;

  const overtime = resolveOvertime(
    input.overtimeEnabled,
    input.overtimeHoursPerWeek,
    input.overtimeMultiplier,
  );
  const weightedHoursPerWeek =
    input.hoursPerWeek + overtime.hours * overtime.multiplier;

  const annual =
    input.inputMode === "hourly" ? input.amount * annualWeightedHours : input.amount;
  const hourly =
    input.inputMode === "annual" ? input.amount / annualWeightedHours : input.amount;

  return {
    annual,
    hourly,
    weekly: annual / input.weeksPerYear,
    biweekly: annual / 26,
    monthly: annual / 12,
    weightedHoursPerWeek,
    annualWeightedHours,
  };
}

export function comparePayBreakdowns(
  scenarioA: PayBreakdown,
  scenarioB: PayBreakdown,
): PayComparison {
  const annualDifference = scenarioB.annual - scenarioA.annual;
  const higherScenario =
    annualDifference > 0 ? "b" : annualDifference < 0 ? "a" : "equal";

  return {
    annualDifference,
    hourlyDifference: scenarioB.hourly - scenarioA.hourly,
    weeklyDifference: scenarioB.weekly - scenarioA.weekly,
    biweeklyDifference: scenarioB.biweekly - scenarioA.biweekly,
    monthlyDifference: scenarioB.monthly - scenarioA.monthly,
    percentAnnualDifference:
      scenarioA.annual > 0 ? (annualDifference / scenarioA.annual) * 100 : null,
    higherScenario,
  };
}
