import { useEffect, useMemo, useState } from "react";
import {
  comparePayBreakdowns,
  derivePayBreakdown,
  normalizeNumericInput,
  type PayBreakdown,
  type PayInputMode,
} from "../../lib/pay";
import {
  DEFAULT_PAY_CALCULATOR_PREFERENCES,
  loadPayCalculatorPreferences,
  savePayCalculatorPreferences,
  type PayCalculatorScenarioPreferences,
} from "./preferences";

type ScenarioId = "scenarioA" | "scenarioB";

interface SchedulePreset {
  id: string;
  label: string;
  hoursPerWeek: string;
  weeksPerYear: string;
}

interface ScenarioDerivedState {
  breakdown: PayBreakdown | null;
  errors: string[];
  sourceLabel: string;
}

const SCHEDULE_PRESETS: SchedulePreset[] = [
  { id: "full-time", label: "Full-time 40x52", hoursPerWeek: "40", weeksPerYear: "52" },
  { id: "part-time", label: "Part-time 20x52", hoursPerWeek: "20", weeksPerYear: "52" },
  { id: "contract", label: "Contract 40x50", hoursPerWeek: "40", weeksPerYear: "50" },
];

const INPUT_LABELS: Record<PayInputMode, string> = {
  annual: "Annual pay",
  hourly: "Hourly pay",
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(value);
}

function formatPercent(value: number) {
  return PERCENT_FORMATTER.format(value / 100);
}

function formatEditableNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function getScenarioSourceValue(
  scenario: PayCalculatorScenarioPreferences,
  inputMode: PayInputMode = scenario.lastEdited,
) {
  return inputMode === "annual" ? scenario.annualPay : scenario.hourlyPay;
}

function deriveScenarioState(
  scenario: PayCalculatorScenarioPreferences,
): ScenarioDerivedState {
  const errors: string[] = [];
  const sourceValue = getScenarioSourceValue(scenario);
  const amount = normalizeNumericInput(sourceValue);
  const hoursPerWeek = normalizeNumericInput(scenario.hoursPerWeek);
  const weeksPerYear = normalizeNumericInput(scenario.weeksPerYear);

  if (amount === null) {
    errors.push(
      `Enter a valid ${scenario.lastEdited === "annual" ? "annual salary" : "hourly rate"}.`,
    );
  }

  if (hoursPerWeek === null || hoursPerWeek <= 0) {
    errors.push("Hours per week must be greater than 0.");
  }

  if (weeksPerYear === null || weeksPerYear <= 0) {
    errors.push("Weeks per year must be greater than 0.");
  }

  let overtimeHoursPerWeek = 0;
  let overtimeMultiplier = 1.5;

  if (scenario.overtimeEnabled) {
    const parsedOvertimeHours = normalizeNumericInput(
      scenario.overtimeHoursPerWeek,
    );
    const parsedOvertimeMultiplier = normalizeNumericInput(
      scenario.overtimeMultiplier,
    );

    if (parsedOvertimeHours === null) {
      errors.push("Enter valid overtime hours.");
    } else {
      overtimeHoursPerWeek = parsedOvertimeHours;
    }

    if (parsedOvertimeMultiplier === null || parsedOvertimeMultiplier < 1) {
      errors.push("Overtime multiplier must be at least 1.");
    } else {
      overtimeMultiplier = parsedOvertimeMultiplier;
    }
  }

  if (
    errors.length > 0
    || amount === null
    || hoursPerWeek === null
    || weeksPerYear === null
  ) {
    return {
      breakdown: null,
      errors,
      sourceLabel: INPUT_LABELS[scenario.lastEdited],
    };
  }

  return {
    breakdown: derivePayBreakdown({
      inputMode: scenario.lastEdited,
      amount,
      hoursPerWeek,
      weeksPerYear,
      overtimeEnabled: scenario.overtimeEnabled,
      overtimeHoursPerWeek,
      overtimeMultiplier,
    }),
    errors,
    sourceLabel: INPUT_LABELS[scenario.lastEdited],
  };
}

function syncScenario(
  scenario: PayCalculatorScenarioPreferences,
): PayCalculatorScenarioPreferences {
  const derived = deriveScenarioState(scenario);
  const counterpartKey =
    scenario.lastEdited === "annual" ? "hourlyPay" : "annualPay";

  if (!derived.breakdown) {
    if (scenario[counterpartKey] === "") return scenario;
    return {
      ...scenario,
      [counterpartKey]: "",
    };
  }

  const counterpartValue =
    scenario.lastEdited === "annual"
      ? formatEditableNumber(derived.breakdown.hourly)
      : formatEditableNumber(derived.breakdown.annual);

  if (scenario[counterpartKey] === counterpartValue) {
    return scenario;
  }

  return {
    ...scenario,
    [counterpartKey]: counterpartValue,
  };
}

function areScenariosEqual(
  left: PayCalculatorScenarioPreferences,
  right: PayCalculatorScenarioPreferences,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ResultGrid({
  breakdown,
  accentClass,
}: {
  breakdown: PayBreakdown;
  accentClass: "teal" | "blue";
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
      <ResultStat
        label="Hourly"
        value={formatCurrency(breakdown.hourly)}
        accentClass={accentClass}
      />
      <ResultStat
        label="Weekly"
        value={formatCurrency(breakdown.weekly)}
        accentClass={accentClass}
      />
      <ResultStat
        label="Biweekly"
        value={formatCurrency(breakdown.biweekly)}
        accentClass={accentClass}
      />
      <ResultStat
        label="Monthly"
        value={formatCurrency(breakdown.monthly)}
        accentClass={accentClass}
      />
      <ResultStat
        label="Annual"
        value={formatCurrency(breakdown.annual)}
        accentClass={accentClass}
      />
    </div>
  );
}

export default function PayCalculatorApp() {
  const savedPreferences = useMemo(loadPayCalculatorPreferences, []);
  const [compareMode, setCompareMode] = useState(savedPreferences.compareMode);
  const [scenarioA, setScenarioA] = useState(() =>
    syncScenario(savedPreferences.scenarioA),
  );
  const [scenarioB, setScenarioB] = useState(() =>
    syncScenario(savedPreferences.scenarioB),
  );

  const derivedA = useMemo(() => deriveScenarioState(scenarioA), [scenarioA]);
  const derivedB = useMemo(() => deriveScenarioState(scenarioB), [scenarioB]);
  const comparison = useMemo(() => {
    if (!compareMode || !derivedA.breakdown || !derivedB.breakdown) {
      return null;
    }

    return comparePayBreakdowns(derivedA.breakdown, derivedB.breakdown);
  }, [compareMode, derivedA.breakdown, derivedB.breakdown]);

  useEffect(() => {
    savePayCalculatorPreferences({
      compareMode,
      scenarioA,
      scenarioB,
    });
  }, [compareMode, scenarioA, scenarioB]);

  function updateScenario(
    scenarioId: ScenarioId,
    updater: (
      previous: PayCalculatorScenarioPreferences,
    ) => PayCalculatorScenarioPreferences,
  ) {
    const setter = scenarioId === "scenarioA" ? setScenarioA : setScenarioB;
    setter((previous) => syncScenario(updater(previous)));
  }

  function updatePayInput(
    scenarioId: ScenarioId,
    inputMode: PayInputMode,
    value: string,
  ) {
    updateScenario(scenarioId, (previous) => ({
      ...previous,
      annualPay: inputMode === "annual" ? value : previous.annualPay,
      hourlyPay: inputMode === "hourly" ? value : previous.hourlyPay,
      lastEdited: inputMode,
    }));
  }

  function updateScenarioField(
    scenarioId: ScenarioId,
    key: keyof PayCalculatorScenarioPreferences,
    value: string | boolean,
  ) {
    updateScenario(scenarioId, (previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function applyPreset(scenarioId: ScenarioId, preset: SchedulePreset) {
    updateScenario(scenarioId, (previous) => ({
      ...previous,
      hoursPerWeek: preset.hoursPerWeek,
      weeksPerYear: preset.weeksPerYear,
    }));
  }

  function handleToggleCompare() {
    setCompareMode((previous) => {
      const nextValue = !previous;
      if (
        nextValue
        && areScenariosEqual(
          scenarioB,
          DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioB,
        )
      ) {
        setScenarioB(syncScenario({ ...scenarioA }));
      }
      return nextValue;
    });
  }

  function copyScenarioAToB() {
    setScenarioB(syncScenario({ ...scenarioA }));
  }

  function resetToDefaults() {
    setCompareMode(DEFAULT_PAY_CALCULATOR_PREFERENCES.compareMode);
    setScenarioA(
      syncScenario({ ...DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioA }),
    );
    setScenarioB(
      syncScenario({ ...DEFAULT_PAY_CALCULATOR_PREFERENCES.scenarioB }),
    );
  }

  const winnerLabel = comparison
    ? comparison.higherScenario === "equal"
      ? "Both scenarios pay the same."
      : comparison.higherScenario === "b"
        ? `Scenario B pays ${formatCurrency(
            comparison.annualDifference,
          )} more annually.`
        : `Scenario A pays ${formatCurrency(
            Math.abs(comparison.annualDifference),
          )} more annually.`
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-card bg-[linear-gradient(135deg,rgba(20,184,166,0.12),rgba(15,23,42,0.92))] p-5 shadow-[0_20px_80px_rgba(13,148,136,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-teal/80">
              Gross Pay Calculator
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
              Convert hourly and annual pay, then compare the offer against your
              current setup.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Weekly pay uses your configured schedule. Biweekly and monthly
              cards stay calendar-based so pay period comparisons stay
              intuitive.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleCompare}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                compareMode
                  ? "border-accent-teal/40 bg-accent-teal/15 text-accent-teal"
                  : "border-border-card bg-bg-card/60 text-text-secondary hover:border-border-card-hover hover:text-text-primary"
              }`}
            >
              <ToggleGlyph enabled={compareMode} />
              Compare another pay
            </button>
            {compareMode && (
              <button
                type="button"
                onClick={copyScenarioAToB}
                className="inline-flex items-center gap-2 rounded-full border border-border-card bg-bg-card/60 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
              >
                Copy A to B
              </button>
            )}
            <button
              type="button"
              onClick={resetToDefaults}
              className="inline-flex items-center gap-2 rounded-full border border-border-card bg-bg-card/60 px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
            >
              Reset defaults
            </button>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${compareMode ? "xl:grid-cols-2" : ""}`}>
        <ScenarioPanel
          accentClass="teal"
          description="Use this as your baseline compensation."
          derived={derivedA}
          onApplyPreset={(preset) => applyPreset("scenarioA", preset)}
          onFieldChange={(key, value) =>
            updateScenarioField("scenarioA", key, value)
          }
          onPayInputChange={(mode, value) =>
            updatePayInput("scenarioA", mode, value)
          }
          presets={SCHEDULE_PRESETS}
          scenario={scenarioA}
          title="Scenario A"
        />

        {compareMode && (
          <ScenarioPanel
            accentClass="blue"
            description="Use this for the competing offer or alternate schedule."
            derived={derivedB}
            onApplyPreset={(preset) => applyPreset("scenarioB", preset)}
            onFieldChange={(key, value) =>
              updateScenarioField("scenarioB", key, value)
            }
            onPayInputChange={(mode, value) =>
              updatePayInput("scenarioB", mode, value)
            }
            presets={SCHEDULE_PRESETS}
            scenario={scenarioB}
            title="Scenario B"
          />
        )}
      </div>

      {compareMode && comparison && (
        <div className="rounded-2xl border border-border-card bg-bg-card p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-blue/80">
                Comparison
              </p>
              <h3 className="mt-2 font-display text-xl font-bold text-text-primary">
                {winnerLabel}
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                {comparison.percentAnnualDifference === null
                  ? "Percent difference is unavailable when Scenario A has no annual pay."
                  : `${
                      comparison.higherScenario === "a"
                        ? "Scenario A"
                        : comparison.higherScenario === "b"
                          ? "Scenario B"
                          : "Neither scenario"
                    } is ${formatPercent(
                      Math.abs(comparison.percentAnnualDifference),
                    )} relative to Scenario A.`}
              </p>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 self-start">
              <ResultStat
                label="Annual delta"
                value={formatCurrency(comparison.annualDifference)}
                accentClass="blue"
              />
              <ResultStat
                label="Hourly delta"
                value={formatCurrency(comparison.hourlyDifference)}
                accentClass="blue"
              />
              <ResultStat
                label="Percent delta"
                value={
                  comparison.percentAnnualDifference === null
                    ? "N/A"
                    : formatPercent(comparison.percentAnnualDifference)
                }
                accentClass="blue"
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            <DeltaStat
              label="Weekly difference"
              value={comparison.weeklyDifference}
            />
            <DeltaStat
              label="Biweekly difference"
              value={comparison.biweeklyDifference}
            />
            <DeltaStat
              label="Monthly difference"
              value={comparison.monthlyDifference}
            />
            <DeltaStat
              label="Annual difference"
              value={comparison.annualDifference}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioPanel({
  accentClass,
  description,
  derived,
  onApplyPreset,
  onFieldChange,
  onPayInputChange,
  presets,
  scenario,
  title,
}: {
  accentClass: "teal" | "blue";
  description: string;
  derived: ScenarioDerivedState;
  onApplyPreset: (preset: SchedulePreset) => void;
  onFieldChange: (
    key: keyof PayCalculatorScenarioPreferences,
    value: string | boolean,
  ) => void;
  onPayInputChange: (mode: PayInputMode, value: string) => void;
  presets: SchedulePreset[];
  scenario: PayCalculatorScenarioPreferences;
  title: string;
}) {
  const accent =
    accentClass === "blue"
      ? {
          badge: "border-accent-blue/20 bg-accent-blue/10 text-accent-blue",
          active: "border-accent-blue/35 bg-accent-blue/10",
          button: "border-accent-blue/25 text-accent-blue hover:bg-accent-blue/10",
        }
      : {
          badge: "border-accent-teal/20 bg-accent-teal/10 text-accent-teal",
          active: "border-accent-teal/35 bg-accent-teal/10",
          button: "border-accent-teal/25 text-accent-teal hover:bg-accent-teal/10",
        };

  return (
    <section className="rounded-2xl border border-border-card bg-bg-card/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${accent.badge}`}
          >
            {title}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${accent.button}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <MoneyInput
          accentClass={accentClass}
          active={scenario.lastEdited === "annual"}
          label="Annual pay"
          onChange={(value) => onPayInputChange("annual", value)}
          sourceLabel={derived.sourceLabel}
          value={scenario.annualPay}
        />
        <MoneyInput
          accentClass={accentClass}
          active={scenario.lastEdited === "hourly"}
          label="Hourly pay"
          onChange={(value) => onPayInputChange("hourly", value)}
          sourceLabel={derived.sourceLabel}
          value={scenario.hourlyPay}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextField
          accentClass={accentClass}
          label="Hours per week"
          onChange={(value) => onFieldChange("hoursPerWeek", value)}
          placeholder="40"
          value={scenario.hoursPerWeek}
        />
        <TextField
          accentClass={accentClass}
          label="Weeks per year"
          onChange={(value) => onFieldChange("weeksPerYear", value)}
          placeholder="52"
          value={scenario.weeksPerYear}
        />
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 ${
          scenario.overtimeEnabled
            ? accent.active
            : "border-border-card bg-bg-secondary/40"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Overtime</p>
            <p className="mt-1 text-xs text-text-muted">
              Add overtime hours per week on top of the base schedule.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onFieldChange("overtimeEnabled", !scenario.overtimeEnabled)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              scenario.overtimeEnabled
                ? accent.badge
                : "border-border-card bg-bg-card text-text-secondary hover:border-border-card-hover hover:text-text-primary"
            }`}
          >
            <ToggleGlyph enabled={scenario.overtimeEnabled} />
            {scenario.overtimeEnabled ? "Overtime enabled" : "Enable overtime"}
          </button>
        </div>

        {scenario.overtimeEnabled && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField
              accentClass={accentClass}
              label="Overtime hours / week"
              onChange={(value) => onFieldChange("overtimeHoursPerWeek", value)}
              placeholder="0"
              value={scenario.overtimeHoursPerWeek}
            />
            <TextField
              accentClass={accentClass}
              label="Overtime multiplier"
              onChange={(value) => onFieldChange("overtimeMultiplier", value)}
              placeholder="1.5"
              value={scenario.overtimeMultiplier}
            />
          </div>
        )}
      </div>

      {derived.errors.length > 0 ? (
        <div className="mt-4 rounded-xl border border-accent-red/20 bg-accent-red/5 px-4 py-3 text-sm text-accent-red">
          {derived.errors[0]}
        </div>
      ) : derived.breakdown ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              Breakdown
            </p>
            <p className="text-xs text-text-muted">
              Weighted hours/year:{" "}
              {formatEditableNumber(derived.breakdown.annualWeightedHours)}
            </p>
          </div>
          <ResultGrid breakdown={derived.breakdown} accentClass={accentClass} />
        </div>
      ) : null}
    </section>
  );
}

function MoneyInput({
  accentClass,
  active,
  label,
  onChange,
  sourceLabel,
  value,
}: {
  accentClass: "teal" | "blue";
  active: boolean;
  label: string;
  onChange: (value: string) => void;
  sourceLabel: string;
  value: string;
}) {
  return (
    <label
      className={`block rounded-xl border px-4 py-3 transition-colors ${
        active
          ? accentClass === "blue"
            ? "border-accent-blue/35 bg-accent-blue/10"
            : "border-accent-teal/35 bg-accent-teal/10"
          : "border-border-card bg-bg-secondary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
          {label}
        </span>
        {sourceLabel === label && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              accentClass === "blue"
                ? "bg-accent-blue/10 text-accent-blue"
                : "bg-accent-teal/10 text-accent-teal"
            }`}
          >
            driving output
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-lg font-semibold text-text-muted">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
    </label>
  );
}

function TextField({
  accentClass,
  label,
  onChange,
  placeholder,
  value,
}: {
  accentClass: "teal" | "blue";
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 ${
          accentClass === "blue"
            ? "border-border-card focus:border-accent-blue/40 focus:ring-1 focus:ring-accent-blue/20"
            : "border-border-card focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
        }`}
      />
    </label>
  );
}

function ResultStat({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: "teal" | "blue";
}) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-secondary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-base font-semibold leading-tight sm:text-lg ${
          accentClass === "blue" ? "text-accent-blue" : "text-accent-teal"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DeltaStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div className="rounded-xl border border-border-card bg-bg-secondary/50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-base font-semibold leading-tight sm:text-lg ${
          isPositive
            ? "text-accent-green"
            : isNegative
              ? "text-accent-red"
              : "text-text-primary"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function ToggleGlyph({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
        enabled
          ? "border-current bg-current/10"
          : "border-border-card bg-bg-secondary"
      }`}
    >
      <span
        className={`absolute h-3.5 w-3.5 rounded-full transition-transform ${
          enabled
            ? "translate-x-4 bg-current"
            : "translate-x-0.5 bg-text-muted"
        }`}
      />
    </span>
  );
}
