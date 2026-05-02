import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  convertHtmlToMarkdown,
  DEFAULT_OPTIONS,
  type HtmlToMdOptions,
} from "../../lib/html-to-markdown";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "localkit:html-to-markdown";

function loadOptions(): HtmlToMdOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function saveOptions(options: HtmlToMdOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage full or unavailable
  }
}

const SAMPLE_HTML = `<h1>Hello, World!</h1>
<p>This is a <strong>sample</strong> HTML document with <em>formatting</em>.</p>

<h2>Features</h2>
<ul>
  <li>Bold and italic text</li>
  <li><a href="https://example.com">Links</a></li>
  <li>Tables and lists</li>
</ul>

<table>
  <thead>
    <tr><th>Feature</th><th>Supported</th></tr>
  </thead>
  <tbody>
    <tr><td>GFM tables</td><td>Yes</td></tr>
    <tr><td>Strikethrough</td><td>Yes</td></tr>
    <tr><td>Task lists</td><td>Yes</td></tr>
  </tbody>
</table>

<blockquote>Paste or upload your HTML to convert it to clean Markdown.</blockquote>`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HtmlToMarkdownApp() {
  const saved = useMemo(loadOptions, []);

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<HtmlToMdOptions>(saved);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist options
  useEffect(() => {
    saveOptions(options);
  }, [options]);

  /* ── Actions ──────────────────────────────────────────────────── */

  const handleConvert = useCallback(() => {
    if (!input.trim()) return;
    setError(null);
    try {
      const result = convertHtmlToMarkdown(input, options);
      setOutput(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setOutput("");
    }
  }, [input, options]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const handleDownload = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setInput(reader.result as string);
        setOutput("");
        setError(null);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleConvert();
      }
    },
    [handleConvert],
  );

  const updateOption = useCallback(
    <K extends keyof HtmlToMdOptions>(key: K, value: HtmlToMdOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* ── Options toggle ────────────────────────────────────────── */}
      <button
        onClick={() => setShowOptions((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${showOptions ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
        Conversion options
        <span className="rounded bg-bg-card px-1.5 py-0.5 text-[10px] text-text-muted">
          Turndown
        </span>
      </button>

      {showOptions && (
        <div className="rounded-lg border border-border-card bg-bg-card/60 p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {/* Toggle options */}
            <ToggleOption
              label="Strip Styles"
              checked={options.stripStyles}
              onChange={(v) => updateOption("stripStyles", v)}
            />
            <ToggleOption
              label="Strip Scripts"
              checked={options.stripScripts}
              onChange={(v) => updateOption("stripScripts", v)}
            />
            <ToggleOption
              label="Strip Images"
              checked={options.stripImages}
              onChange={(v) => updateOption("stripImages", v)}
            />
            <ToggleOption
              label="GFM Support"
              checked={options.enableGfm}
              onChange={(v) => updateOption("enableGfm", v)}
            />
            <ToggleOption
              label="Preserve Line Breaks"
              checked={options.preserveLineBreaks}
              onChange={(v) => updateOption("preserveLineBreaks", v)}
            />

            {/* Select options */}
            <SelectOption
              label="Heading Style"
              value={options.headingStyle}
              options={[
                { value: "atx", label: "ATX (#)" },
                { value: "setext", label: "Setext (underline)" },
              ]}
              onChange={(v) =>
                updateOption(
                  "headingStyle",
                  v as HtmlToMdOptions["headingStyle"],
                )
              }
            />
            <SelectOption
              label="Bullet Marker"
              value={options.bulletListMarker}
              options={[
                { value: "-", label: "Dash (-)" },
                { value: "*", label: "Asterisk (*)" },
                { value: "+", label: "Plus (+)" },
              ]}
              onChange={(v) =>
                updateOption(
                  "bulletListMarker",
                  v as HtmlToMdOptions["bulletListMarker"],
                )
              }
            />
            <SelectOption
              label="Code Blocks"
              value={options.codeBlockStyle}
              options={[
                { value: "fenced", label: "Fenced (```)" },
                { value: "indented", label: "Indented" },
              ]}
              onChange={(v) =>
                updateOption(
                  "codeBlockStyle",
                  v as HtmlToMdOptions["codeBlockStyle"],
                )
              }
            />
            <SelectOption
              label="Link Style"
              value={options.linkStyle}
              options={[
                { value: "inlined", label: "Inline [text](url)" },
                { value: "referenced", label: "Referenced [text][1]" },
              ]}
              onChange={(v) =>
                updateOption("linkStyle", v as HtmlToMdOptions["linkStyle"])
              }
            />
          </div>
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">
            HTML Input
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-secondary px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary hover:border-border-card-hover"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Upload .html
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCopied(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={SAMPLE_HTML}
          rows={12}
          className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-orange/40 focus:outline-none focus:ring-1 focus:ring-accent-orange/20 transition-colors resize-y leading-relaxed"
        />
      </div>

      {/* ── Convert button ────────────────────────────────────────── */}
      <button
        onClick={handleConvert}
        disabled={!input.trim()}
        className="inline-flex items-center gap-2 rounded-lg border border-accent-orange/25 bg-accent-orange/15 px-4 py-2 text-sm font-medium text-accent-orange transition-all hover:bg-accent-orange/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
          />
        </svg>
        Convert to Markdown
        <span className="text-[10px] opacity-60">Ctrl+Enter</span>
      </button>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Output ────────────────────────────────────────────────── */}
      {output && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              Markdown Output
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-secondary px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary hover:border-border-card-hover"
              >
                {copied ? (
                  <>
                    <svg
                      className="h-3 w-3 text-accent-green"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-secondary px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary hover:border-border-card-hover"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download .md
              </button>
            </div>
          </div>
          <pre className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 font-mono text-sm text-text-primary overflow-x-auto leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked
            ? "border-accent-orange/40 bg-accent-orange/20"
            : "border-border-card bg-bg-secondary"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
            checked
              ? "translate-x-4 bg-accent-orange"
              : "translate-x-0.5 bg-text-muted"
          }`}
        />
      </button>
    </label>
  );
}

function SelectOption({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-card bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:border-accent-orange/40 focus:outline-none focus:ring-1 focus:ring-accent-orange/20 transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
