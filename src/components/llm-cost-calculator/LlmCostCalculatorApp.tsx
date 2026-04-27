import { useEffect, useMemo, useState } from "react";
import Autocomplete, { type AutocompleteOption } from "../ui/Autocomplete";
import Modal from "../ui/Modal";
import {
  DEFAULT_LLM_MODELS,
  calculateLlmUsageCost,
  createLlmModelId,
  getLlmCostModels,
  isDefaultLlmModel,
  loadLlmCostPreferences,
  normalizeNumericInput,
  resetDefaultLlmModel,
  saveLlmCostPreferences,
  sanitizeLlmModel,
  type LlmCostPreferences,
  type LlmModel,
} from "../../lib/llm-cost";

interface ModelFormState {
  name: string;
  provider: string;
  inputCostPerMillion: string;
  outputCostPerMillion: string;
}

interface PricingEditorState {
  mode: "add" | "edit";
  modelId: string;
  form: ModelFormState;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

const DEFAULT_MODEL_BY_ID = new Map(
  DEFAULT_LLM_MODELS.map((model) => [model.id, model]),
);

const EMPTY_MODEL_FORM: ModelFormState = {
  name: "",
  provider: "",
  inputCostPerMillion: "",
  outputCostPerMillion: "",
};

const panelClass = "rounded-lg border border-border-card bg-bg-card";
const fieldClass =
  "w-full rounded-md border border-border-card bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/45 focus:ring-1 focus:ring-accent-teal/20";
const quietButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border-card bg-bg-secondary px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45";

function formatCost(value: number) {
  if (value > 0 && value < 0.000001) return "<$0.000001";
  return CURRENCY_FORMATTER.format(value);
}

function formatRate(value: number) {
  return `$${NUMBER_FORMATTER.format(value)}`;
}

function modelToForm(model: LlmModel): ModelFormState {
  return {
    name: model.name,
    provider: model.provider,
    inputCostPerMillion: String(model.inputCostPerMillion),
    outputCostPerMillion: String(model.outputCostPerMillion),
  };
}

function formToModel(form: ModelFormState, id: string): LlmModel | null {
  return sanitizeLlmModel({
    id,
    name: form.name,
    provider: form.provider,
    inputCostPerMillion: form.inputCostPerMillion,
    outputCostPerMillion: form.outputCostPerMillion,
  });
}

function hasDefaultOverride(preferences: LlmCostPreferences, modelId: string) {
  return Boolean(preferences.defaultModelOverrides[modelId]);
}

export default function LlmCostCalculatorApp() {
  const savedPreferences = useMemo(loadLlmCostPreferences, []);
  const [preferences, setPreferences] = useState(savedPreferences);
  const [pricingEditor, setPricingEditor] = useState<PricingEditorState | null>(
    null,
  );
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");

  const models = useMemo(() => getLlmCostModels(preferences), [preferences]);
  const selectedModel = models.find(
    (model) => model.id === preferences.selectedModelId,
  );
  const selectedIsDefault = selectedModel
    ? isDefaultLlmModel(selectedModel.id)
    : false;
  const selectedHasOverride =
    selectedModel && selectedIsDefault
      ? hasDefaultOverride(preferences, selectedModel.id)
      : false;

  const inputTokens = normalizeNumericInput(preferences.inputTokens);
  const outputTokens = normalizeNumericInput(preferences.outputTokens);
  const costBreakdown =
    selectedModel && inputTokens !== null && outputTokens !== null
      ? calculateLlmUsageCost(selectedModel, inputTokens, outputTokens)
      : null;

  const modelOptions: AutocompleteOption[] = models.map((model) => ({
    id: model.id,
    label: model.name,
    description: `${model.provider} - ${formatRate(model.inputCostPerMillion)} input / ${formatRate(
      model.outputCostPerMillion,
    )} output per 1M`,
  }));

  useEffect(() => {
    saveLlmCostPreferences(preferences);
  }, [preferences]);

  function updatePreferences(
    updater: (previous: LlmCostPreferences) => LlmCostPreferences,
  ) {
    setPreferences((previous) => updater(previous));
  }

  function selectModel(modelId: string) {
    const nextModel = models.find((model) => model.id === modelId);
    if (!nextModel) return;

    setPreferences((previous) => ({ ...previous, selectedModelId: modelId }));
    setNotice("");
  }

  function openAddModel() {
    setPricingEditor({
      mode: "add",
      modelId: "",
      form: EMPTY_MODEL_FORM,
    });
    setEditorError("");
  }

  function openEditModel() {
    if (!selectedModel) return;

    setPricingEditor({
      mode: "edit",
      modelId: selectedModel.id,
      form: modelToForm(selectedModel),
    });
    setEditorError("");
  }

  function updateEditorForm(update: Partial<ModelFormState>) {
    setPricingEditor((previous) =>
      previous
        ? {
            ...previous,
            form: {
              ...previous.form,
              ...update,
            },
          }
        : previous,
    );
  }

  function closeEditor() {
    setPricingEditor(null);
    setEditorError("");
  }

  function saveEditorModel() {
    if (!pricingEditor) return;

    const nextId =
      pricingEditor.mode === "add"
        ? createLlmModelId(
            models,
            pricingEditor.form.name || "Custom model",
            pricingEditor.form.provider || "Custom",
          )
        : pricingEditor.modelId;

    const nextModel = formToModel(pricingEditor.form, nextId);
    if (!nextModel) {
      setEditorError(
        "Enter a model name, provider, and non-negative input/output rates.",
      );
      return;
    }

    updatePreferences((previous) => {
      if (pricingEditor.mode === "add") {
        return {
          ...previous,
          selectedModelId: nextModel.id,
          customModels: [...previous.customModels, nextModel],
        };
      }

      if (isDefaultLlmModel(nextModel.id)) {
        return {
          ...previous,
          defaultModelOverrides: {
            ...previous.defaultModelOverrides,
            [nextModel.id]: nextModel,
          },
        };
      }

      return {
        ...previous,
        customModels: previous.customModels.map((model) =>
          model.id === nextModel.id ? nextModel : model,
        ),
      };
    });
    setNotice(
      pricingEditor.mode === "add"
        ? `${nextModel.name} added to local storage.`
        : `${nextModel.name} saved in this browser.`,
    );
    closeEditor();
  }

  function deleteSelectedModel() {
    if (!selectedModel || selectedIsDefault) return;

    setPreferences((previous) => ({
      ...previous,
      selectedModelId: "",
      customModels: previous.customModels.filter(
        (model) => model.id !== selectedModel.id,
      ),
    }));
    setNotice(`${selectedModel.name} deleted from local storage.`);
    closeEditor();
  }

  function resetSelectedDefault() {
    if (!selectedModel || !selectedIsDefault) return;

    const defaultModel = DEFAULT_MODEL_BY_ID.get(selectedModel.id);
    if (!defaultModel) return;

    setPreferences((previous) =>
      resetDefaultLlmModel(previous, selectedModel.id),
    );
    setNotice(`${defaultModel.name} reset to the default pricing.`);
    closeEditor();
  }

  return (
    <div className="space-y-5">
      <section className={`${panelClass} overflow-hidden`}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-teal">
                  Cost estimate
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
                  Model usage
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
                  Pricing is USD per 1 million tokens. Counts and custom pricing
                  stay in this browser.
                </p>
              </div>

              {selectedModel && (
                <ModelBadge
                  label={selectedIsDefault ? "Default model" : "Custom model"}
                  hasOverride={Boolean(selectedHasOverride)}
                />
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <Autocomplete
                id="llm-model"
                label="Model"
                options={modelOptions}
                value={selectedModel?.id ?? ""}
                onChange={selectModel}
                placeholder="Search models"
                emptyLabel="No models match that search"
              />

              {selectedModel && <SelectedModelRates model={selectedModel} />}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TokenField
                label="Input tokens"
                value={preferences.inputTokens}
                onChange={(value) =>
                  updatePreferences((previous) => ({
                    ...previous,
                    inputTokens: value,
                  }))
                }
              />
              <TokenField
                label="Output tokens"
                value={preferences.outputTokens}
                onChange={(value) =>
                  updatePreferences((previous) => ({
                    ...previous,
                    outputTokens: value,
                  }))
                }
              />
            </div>
          </div>

          <ResultPanel
            costBreakdown={costBreakdown}
            hasSelectedModel={Boolean(selectedModel)}
          />
        </div>
      </section>

      <section className={`${panelClass} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Pricing
            </p>
            <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
              Model pricing
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Add a custom model or edit pricing for the selected model in a
              focused dialog.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModel}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-accent-teal/30 bg-accent-teal/10 px-3 py-2 text-sm font-medium text-accent-teal transition-colors hover:bg-accent-teal/15"
          >
            <PlusIcon />
            Add model
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4 rounded-md border border-border-card bg-bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-muted">
              Selected model
            </p>
            <p className="mt-1 font-display text-base font-semibold text-text-primary">
              {selectedModel?.name ?? "No model selected"}
            </p>
            {selectedModel && (
              <p className="mt-1 text-xs text-text-muted">
                {selectedModel.provider} ·{" "}
                {formatRate(selectedModel.inputCostPerMillion)} input /{" "}
                {formatRate(selectedModel.outputCostPerMillion)} output per 1M
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={openEditModel}
            disabled={!selectedModel}
            className={`${quietButtonClass} shrink-0`}
          >
            Edit model
          </button>
        </div>

        {notice && (
          <p className="mt-4 rounded-md border border-accent-green/20 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
            {notice}
          </p>
        )}
      </section>

      <ModelPricingModal
        editor={pricingEditor}
        editorError={editorError}
        selectedIsDefault={selectedIsDefault}
        selectedHasOverride={Boolean(selectedHasOverride)}
        onClose={closeEditor}
        onFormChange={updateEditorForm}
        onSave={saveEditorModel}
        onResetDefault={resetSelectedDefault}
        onDelete={deleteSelectedModel}
      />
    </div>
  );
}

function ModelPricingModal({
  editor,
  editorError,
  selectedIsDefault,
  selectedHasOverride,
  onClose,
  onFormChange,
  onSave,
  onResetDefault,
  onDelete,
}: {
  editor: PricingEditorState | null;
  editorError: string;
  selectedIsDefault: boolean;
  selectedHasOverride: boolean;
  onClose: () => void;
  onFormChange: (update: Partial<ModelFormState>) => void;
  onSave: () => void;
  onResetDefault: () => void;
  onDelete: () => void;
}) {
  const isEditing = editor?.mode === "edit";

  return (
    <Modal
      isOpen={Boolean(editor)}
      title={isEditing ? "Edit model pricing" : "Add model"}
      description={
        isEditing
          ? "Update the selected model pricing stored in this browser."
          : "Create a custom model and save its pricing locally."
      }
      onClose={onClose}
    >
      {editor && (
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Model name"
              value={editor.form.name}
              autoFocus
              onChange={(value) => onFormChange({ name: value })}
            />
            <TextField
              label="Provider"
              value={editor.form.provider}
              onChange={(value) => onFormChange({ provider: value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Input $ / 1M"
              inputMode="decimal"
              value={editor.form.inputCostPerMillion}
              onChange={(value) => onFormChange({ inputCostPerMillion: value })}
            />
            <TextField
              label="Output $ / 1M"
              inputMode="decimal"
              value={editor.form.outputCostPerMillion}
              onChange={(value) =>
                onFormChange({ outputCostPerMillion: value })
              }
            />
          </div>

          {editorError && (
            <p className="rounded-md border border-accent-red/20 bg-accent-red/5 px-3 py-2 text-sm leading-relaxed text-accent-red">
              {editorError}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border-card pt-4">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center rounded-md border border-accent-teal/30 bg-accent-teal/10 px-4 py-2 text-sm font-medium text-accent-teal transition-colors hover:bg-accent-teal/15"
            >
              {isEditing ? "Save pricing" : "Add model"}
            </button>
            {isEditing && selectedIsDefault && (
              <button
                type="button"
                onClick={onResetDefault}
                disabled={!selectedHasOverride}
                className={quietButtonClass}
              >
                Reset default
              </button>
            )}
            {isEditing && !selectedIsDefault && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center justify-center rounded-md border border-accent-red/25 bg-accent-red/5 px-4 py-2 text-sm font-medium text-accent-red transition-colors hover:bg-accent-red/10"
              >
                Delete model
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={quietButtonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SelectedModelRates({ model }: { model: LlmModel }) {
  return (
    <div className="grid h-[42px] grid-cols-2 self-end overflow-hidden rounded-lg border border-border-card bg-bg-secondary/45">
      <RateStat
        label="Input / 1M"
        value={formatRate(model.inputCostPerMillion)}
      />
      <RateStat
        label="Output / 1M"
        value={formatRate(model.outputCostPerMillion)}
      />
    </div>
  );
}

function ResultPanel({
  costBreakdown,
  hasSelectedModel,
}: {
  costBreakdown: ReturnType<typeof calculateLlmUsageCost>;
  hasSelectedModel: boolean;
}) {
  return (
    <aside className="border-t border-border-card bg-bg-secondary/55 p-5 sm:p-6 lg:border-l lg:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
        Estimated total
      </p>
      {costBreakdown ? (
        <>
          <p className="mt-3 font-display text-4xl font-semibold text-text-primary">
            {formatCost(costBreakdown.totalCost)}
          </p>
          <div className="mt-6 space-y-3">
            <CostRow
              label="Input"
              value={formatCost(costBreakdown.inputCost)}
            />
            <CostRow
              label="Output"
              value={formatCost(costBreakdown.outputCost)}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-md border border-accent-red/20 bg-accent-red/5 px-3 py-2 text-sm leading-relaxed text-accent-red">
          {hasSelectedModel
            ? "Enter non-negative token counts to calculate the estimate."
            : "Select a model to calculate the estimate."}
        </p>
      )}
    </aside>
  );
}

function TokenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        className="w-full rounded-md border border-border-card bg-bg-secondary px-3 py-3 font-mono text-lg font-semibold text-text-primary outline-none transition-colors placeholder:text-text-muted/40 focus:border-accent-teal/45 focus:ring-1 focus:ring-accent-teal/20"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  inputMode = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal";
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={fieldClass}
      />
    </label>
  );
}

function RateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-center border-r border-border-card px-3 py-1.5 last:border-r-0">
      <p className="text-[11px] leading-none text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold leading-none text-text-primary">
        {value}
      </p>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border-card pt-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function ModelBadge({
  label,
  hasOverride,
}: {
  label: string;
  hasOverride: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-md border border-border-card bg-bg-secondary px-2.5 py-1 font-medium text-text-secondary">
        {label}
      </span>
      {hasOverride && (
        <span className="rounded-md border border-accent-orange/25 bg-accent-orange/10 px-2.5 py-1 font-medium text-accent-orange">
          Local override
        </span>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4.5v15m7.5-7.5h-15"
      />
    </svg>
  );
}
