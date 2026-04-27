import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LLM_COST_PREFERENCES,
  DEFAULT_LLM_MODELS,
  LLM_COST_PREFERENCES_KEY,
  calculateLlmUsageCost,
  createLlmModelId,
  getLlmCostModels,
  loadLlmCostPreferences,
  resetDefaultLlmModel,
  saveLlmCostPreferences,
  sanitizeLlmCostPreferences,
} from "../src/lib/llm-cost";

describe("llm cost calculator", () => {
  it("loads default models from the seed data", () => {
    expect(DEFAULT_LLM_MODELS.length).toBeGreaterThan(10);
    expect(DEFAULT_LLM_MODELS[0]).toMatchObject({
      id: "openai-gpt-5-5",
      name: "GPT 5.5",
      provider: "OpenAI",
      inputCostPerMillion: 5,
      outputCostPerMillion: 30,
    });
  });

  it("starts without a selected model by default", () => {
    expect(DEFAULT_LLM_COST_PREFERENCES.selectedModelId).toBe("");
    expect(sanitizeLlmCostPreferences(undefined).selectedModelId).toBe("");
  });

  it("calculates input, output, and total costs per million tokens", () => {
    const model = {
      id: "test-model",
      name: "Test Model",
      provider: "Test",
      inputCostPerMillion: 2,
      outputCostPerMillion: 10,
    };

    expect(calculateLlmUsageCost(model, 250000, 10000)).toEqual({
      inputCost: 0.5,
      outputCost: 0.1,
      totalCost: 0.6,
    });
  });

  it("merges default model overrides with custom models", () => {
    const defaultModel = DEFAULT_LLM_MODELS[0];
    const preferences = sanitizeLlmCostPreferences({
      selectedModelId: defaultModel.id,
      inputTokens: "1000",
      outputTokens: "500",
      defaultModelOverrides: {
        [defaultModel.id]: {
          ...defaultModel,
          inputCostPerMillion: 9,
        },
      },
      customModels: [
        {
          id: "custom-acme-model",
          name: "Acme Model",
          provider: "Acme",
          inputCostPerMillion: 0.5,
          outputCostPerMillion: 1.5,
        },
      ],
    });

    const models = getLlmCostModels(preferences);
    expect(
      models.find((model) => model.id === defaultModel.id)?.inputCostPerMillion,
    ).toBe(9);
    expect(models.find((model) => model.id === "custom-acme-model")?.name).toBe(
      "Acme Model",
    );
  });

  it("resets default model overrides without removing custom models", () => {
    const defaultModel = DEFAULT_LLM_MODELS[0];
    const preferences = sanitizeLlmCostPreferences({
      selectedModelId: defaultModel.id,
      defaultModelOverrides: {
        [defaultModel.id]: {
          ...defaultModel,
          outputCostPerMillion: 99,
        },
      },
      customModels: [
        {
          id: "custom-test",
          name: "Custom Test",
          provider: "Test",
          inputCostPerMillion: 1,
          outputCostPerMillion: 2,
        },
      ],
    });

    const reset = resetDefaultLlmModel(preferences, defaultModel.id);
    const models = getLlmCostModels(reset);

    expect(models.find((model) => model.id === defaultModel.id)).toEqual(
      defaultModel,
    );
    expect(models.find((model) => model.id === "custom-test")).toBeDefined();
  });

  it("saves sanitized preferences to storage", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    saveLlmCostPreferences(
      {
        selectedModelId: DEFAULT_LLM_MODELS[0].id,
        inputTokens: " 2,500 ",
        outputTokens: " -1 ",
        customModels: [],
        defaultModelOverrides: {},
      },
      storage,
    );

    expect(storage.setItem).toHaveBeenCalledWith(
      LLM_COST_PREFERENCES_KEY,
      JSON.stringify({
        selectedModelId: DEFAULT_LLM_MODELS[0].id,
        inputTokens: "2500",
        outputTokens: "10000",
        customModels: [],
        defaultModelOverrides: {},
      }),
    );
  });

  it("sanitizes pasted currency values in model rates", () => {
    const sanitized = sanitizeLlmCostPreferences({
      customModels: [
        {
          id: "custom-priced",
          name: "Priced",
          provider: "Acme",
          inputCostPerMillion: "$0.50",
          outputCostPerMillion: "$1.25",
        },
      ],
    });

    expect(sanitized.customModels[0]).toMatchObject({
      inputCostPerMillion: 0.5,
      outputCostPerMillion: 1.25,
    });
  });

  it("loads defaults when stored preferences are malformed", () => {
    const storage = {
      getItem: vi.fn(() => "{bad-json"),
      setItem: vi.fn(),
    };

    expect(loadLlmCostPreferences(storage)).toEqual(
      sanitizeLlmCostPreferences(undefined),
    );
  });

  it("loads a previously selected model from storage", () => {
    const selectedModelId = DEFAULT_LLM_MODELS[1].id;
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          selectedModelId,
          inputTokens: "1000",
          outputTokens: "2000",
          customModels: [],
          defaultModelOverrides: {},
        }),
      ),
      setItem: vi.fn(),
    };

    expect(loadLlmCostPreferences(storage).selectedModelId).toBe(
      selectedModelId,
    );
  });

  it("creates stable custom model ids without colliding", () => {
    const models = [
      ...DEFAULT_LLM_MODELS,
      {
        id: "custom-acme-fast",
        name: "Fast",
        provider: "Acme",
        inputCostPerMillion: 1,
        outputCostPerMillion: 1,
      },
    ];

    expect(createLlmModelId(models, "Fast", "Acme")).toBe("custom-acme-fast-2");
  });
});
