import modelPricingSeed from "../data/llm-model-pricing.json";

export interface LlmModel {
  id: string;
  name: string;
  provider: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface LlmCostPreferences {
  selectedModelId: string;
  inputTokens: string;
  outputTokens: string;
  customModels: LlmModel[];
  defaultModelOverrides: Record<string, LlmModel>;
}

export interface LlmCostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const LLM_COST_PREFERENCES_KEY = "localkit:llm-cost-calculator";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTokenText(value: unknown, fallback: string) {
  if (typeof value === "string" && !value.trim()) return "";

  const parsed = normalizeNumericInput(value);
  if (parsed === null) return fallback;
  return formatStoredNumber(parsed);
}

function formatStoredNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function normalizeModelSeedData(seed: unknown): LlmModel[] {
  if (!Array.isArray(seed)) return [];

  const seen = new Set<string>();

  return seed
    .map((entry) => {
      const model = sanitizeLlmModel(entry);
      if (!model) return null;

      const baseId = model.id || slugify(`${model.provider}-${model.name}`);
      let id = baseId || "model";
      let suffix = 2;

      while (seen.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seen.add(id);

      return {
        ...model,
        id,
      };
    })
    .filter((model): model is LlmModel => model !== null);
}

export const DEFAULT_LLM_MODELS = normalizeModelSeedData(modelPricingSeed);

const DEFAULT_MODEL_ID_SET = new Set(
  DEFAULT_LLM_MODELS.map((model) => model.id),
);

export const DEFAULT_LLM_COST_PREFERENCES: LlmCostPreferences = {
  selectedModelId: "",
  inputTokens: "100000",
  outputTokens: "10000",
  customModels: [],
  defaultModelOverrides: {},
};

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

export function calculateLlmUsageCost(
  model: LlmModel,
  inputTokens: number,
  outputTokens: number,
): LlmCostBreakdown | null {
  if (
    !Number.isFinite(inputTokens) ||
    inputTokens < 0 ||
    !Number.isFinite(outputTokens) ||
    outputTokens < 0
  ) {
    return null;
  }

  const inputCost = (inputTokens / 1_000_000) * model.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPerMillion;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

export function createLlmModelId(
  models: LlmModel[],
  name: string,
  provider: string,
) {
  const existingIds = new Set(models.map((model) => model.id));
  const baseId = `custom-${slugify(`${provider}-${name}`) || "model"}`;
  let id = baseId;
  let suffix = 2;

  while (existingIds.has(id) || DEFAULT_MODEL_ID_SET.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return id;
}

export function isDefaultLlmModel(modelId: string) {
  return DEFAULT_MODEL_ID_SET.has(modelId);
}

export function sanitizeLlmModel(
  value: unknown,
  fallback?: LlmModel,
): LlmModel | null {
  if (!value || typeof value !== "object")
    return fallback ? { ...fallback } : null;

  const candidate = value as Partial<LlmModel>;
  const name =
    typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim()
      : fallback?.name;
  const provider =
    typeof candidate.provider === "string" && candidate.provider.trim()
      ? candidate.provider.trim()
      : fallback?.provider;
  const id =
    typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id.trim()
      : fallback?.id;
  const inputCostPerMillion =
    normalizeNumericInput(candidate.inputCostPerMillion) ??
    fallback?.inputCostPerMillion;
  const outputCostPerMillion =
    normalizeNumericInput(candidate.outputCostPerMillion) ??
    fallback?.outputCostPerMillion;
  if (
    !id ||
    !name ||
    !provider ||
    inputCostPerMillion === undefined ||
    outputCostPerMillion === undefined
  ) {
    return null;
  }

  return {
    id,
    name,
    provider,
    inputCostPerMillion,
    outputCostPerMillion,
  };
}

export function getLlmCostModels(preferences: LlmCostPreferences): LlmModel[] {
  const builtIns = DEFAULT_LLM_MODELS.map((model) => {
    const override = preferences.defaultModelOverrides[model.id];
    return override ? (sanitizeLlmModel(override, model) ?? model) : model;
  });
  const builtInIds = new Set(builtIns.map((model) => model.id));
  const customModels = preferences.customModels.filter(
    (model) => !builtInIds.has(model.id),
  );

  return [...builtIns, ...customModels];
}

export function resetDefaultLlmModel(
  preferences: LlmCostPreferences,
  modelId: string,
): LlmCostPreferences {
  const { [modelId]: _removed, ...defaultModelOverrides } =
    preferences.defaultModelOverrides;
  return {
    ...preferences,
    defaultModelOverrides,
  };
}

export function sanitizeLlmCostPreferences(value: unknown): LlmCostPreferences {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_LLM_COST_PREFERENCES,
      customModels: [],
      defaultModelOverrides: {},
    };
  }

  const candidate = value as Partial<LlmCostPreferences>;
  const defaultModelById = new Map(
    DEFAULT_LLM_MODELS.map((model) => [model.id, model]),
  );
  const defaultModelOverrides: Record<string, LlmModel> = {};

  if (
    candidate.defaultModelOverrides &&
    typeof candidate.defaultModelOverrides === "object"
  ) {
    Object.entries(candidate.defaultModelOverrides).forEach(
      ([modelId, override]) => {
        const fallback = defaultModelById.get(modelId);
        if (!fallback) return;

        const sanitized = sanitizeLlmModel(
          { ...(override as object), id: modelId },
          fallback,
        );
        if (sanitized) defaultModelOverrides[modelId] = sanitized;
      },
    );
  }

  const customModels = Array.isArray(candidate.customModels)
    ? candidate.customModels
        .map((model) => sanitizeLlmModel(model))
        .filter(
          (model): model is LlmModel =>
            model !== null && !DEFAULT_MODEL_ID_SET.has(model.id),
        )
    : [];

  const allModelIds = new Set([
    ...DEFAULT_LLM_MODELS.map((model) => model.id),
    ...customModels.map((model) => model.id),
  ]);
  const selectedModelId =
    typeof candidate.selectedModelId === "string" &&
    (candidate.selectedModelId === "" ||
      allModelIds.has(candidate.selectedModelId))
      ? candidate.selectedModelId
      : DEFAULT_LLM_COST_PREFERENCES.selectedModelId;

  return {
    selectedModelId,
    inputTokens: normalizeTokenText(
      candidate.inputTokens,
      DEFAULT_LLM_COST_PREFERENCES.inputTokens,
    ),
    outputTokens: normalizeTokenText(
      candidate.outputTokens,
      DEFAULT_LLM_COST_PREFERENCES.outputTokens,
    ),
    customModels,
    defaultModelOverrides,
  };
}

export function loadLlmCostPreferences(
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): LlmCostPreferences {
  try {
    const raw = storage?.getItem(LLM_COST_PREFERENCES_KEY);
    if (!raw) return sanitizeLlmCostPreferences(undefined);

    return sanitizeLlmCostPreferences(JSON.parse(raw));
  } catch {
    return sanitizeLlmCostPreferences(undefined);
  }
}

export function saveLlmCostPreferences(
  preferences: LlmCostPreferences,
  storage: StorageLike | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
) {
  try {
    storage?.setItem(
      LLM_COST_PREFERENCES_KEY,
      JSON.stringify(sanitizeLlmCostPreferences(preferences)),
    );
  } catch {
    // Storage may be disabled, unavailable, or full.
  }
}
