import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TITLE_FORMAT_MODES,
  formatTitle,
  type TitleFormatMode,
} from "../../lib/title-formatting";
import {
  loadTitleFormatterPreferences,
  saveTitleFormatterPreferences,
} from "./preferences";

const MODE_LABELS: Record<TitleFormatMode, string> = {
  title: "Title Case",
  sentence: "Sentence case",
  uppercase: "UPPERCASE",
  lowercase: "lowercase",
  "first-letter": "First Letter",
  alt: "AlT cAsE",
  toggle: "tOgGlE cAsE",
};

const SAMPLE_INPUT = "make every title ready for publishing";

export default function TitleFormatterApp() {
  const savedPreferences = useMemo(loadTitleFormatterPreferences, []);
  const [mode, setMode] = useState<TitleFormatMode>(savedPreferences.mode);
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [copied, setCopied] = useState(false);

  const output = formatTitle(input, mode);

  useEffect(() => {
    saveTitleFormatterPreferences({ mode });
  }, [mode]);

  const handleModeChange = useCallback((nextMode: TitleFormatMode) => {
    setMode(nextMode);
    setCopied(false);
  }, []);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setCopied(false);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-medium text-text-secondary">
          Format
        </label>
        <div className="flex flex-wrap gap-2">
          {TITLE_FORMAT_MODES.map((formatMode) => (
            <button
              key={formatMode}
              type="button"
              onClick={() => handleModeChange(formatMode)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === formatMode
                  ? "border-accent-teal/25 bg-accent-teal/15 text-accent-teal"
                  : "border-border-card bg-bg-secondary text-text-muted hover:border-border-card-hover hover:text-text-secondary"
              }`}
            >
              {MODE_LABELS[formatMode]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-text-secondary">
            Input
          </label>
          <button
            type="button"
            onClick={handleClear}
            disabled={!input}
            className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-secondary disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <textarea
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setCopied(false);
          }}
          rows={5}
          placeholder="Paste a title, heading, or list of titles..."
          className="w-full resize-y rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 text-sm leading-relaxed text-text-primary transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:outline-none focus:ring-1 focus:ring-accent-teal/20"
          spellCheck={false}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-text-secondary">
            Output
          </label>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!output}
            className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-accent-teal/10 hover:text-accent-teal disabled:pointer-events-none disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="min-h-[7rem] whitespace-pre-wrap break-words rounded-lg border border-border-card bg-bg-card/60 px-3 py-2.5 text-sm leading-relaxed text-text-primary">
          {output || (
            <span className="text-text-muted/50">
              Formatted title will appear here...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
