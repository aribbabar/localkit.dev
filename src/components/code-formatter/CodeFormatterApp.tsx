import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  LANGUAGES,
  THEMES,
  DEFAULT_PRETTIER_OPTIONS,
  DEFAULT_CLANG_OPTIONS,
  CLANG_PRESETS,
  formatCode,
  highlightCode,
  type LanguageDef,
  type PrettierUserOptions,
  type ClangUserOptions,
} from "../../lib/formatter";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "localkit:code-formatter";

interface SavedSettings {
  langId: string;
  themeId: string;
  prettierOpts: PrettierUserOptions;
  clangOpts: ClangUserOptions;
  showLineNumbers: boolean;
  imageBackground: string;
  imagePadding: number;
}

const IMAGE_BACKGROUNDS = [
  { id: "gradient-blue", label: "Ocean", css: "linear-gradient(145deg, #0a2463 0%, #1e6091 50%, #168aad 100%)" },
  { id: "gradient-purple", label: "Nebula", css: "linear-gradient(145deg, #2d1b69 0%, #6b21a8 50%, #a855f7 100%)" },
  { id: "gradient-green", label: "Forest", css: "linear-gradient(145deg, #1a2e1a 0%, #2d5a27 50%, #4ade80 100%)" },
  { id: "gradient-sunset", label: "Sunset", css: "linear-gradient(145deg, #7f1d1d 0%, #c2410c 50%, #f59e0b 100%)" },
  { id: "gradient-nord", label: "Nord", css: "linear-gradient(145deg, #2e3440 0%, #3b4252 50%, #434c5e 100%)" },
  { id: "gradient-rose", label: "Rose", css: "linear-gradient(145deg, #4c0519 0%, #9f1239 50%, #f43f5e 100%)" },
  { id: "gradient-cyan", label: "Cyan", css: "linear-gradient(145deg, #083344 0%, #155e75 50%, #22d3ee 100%)" },
  { id: "solid-dark", label: "Dark", css: "#1a1b26" },
  { id: "solid-black", label: "Black", css: "#000000" },
  { id: "solid-white", label: "White", css: "#f8fafc" },
  { id: "transparent", label: "None", css: "transparent" },
] as const;

function loadSettings(): Partial<SavedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.langId && !LANGUAGES.find((l) => l.id === parsed.langId)) {
      parsed.langId = undefined;
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveSettings(settings: SavedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable
  }
}

function groupLanguages() {
  const groups = new Map<string, LanguageDef[]>();
  for (const lang of LANGUAGES) {
    const arr = groups.get(lang.group) ?? [];
    arr.push(lang);
    groups.set(lang.group, arr);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CodeFormatterApp() {
  const saved = useMemo(loadSettings, []);

  const [langId, setLangId] = useState(saved.langId ?? "javascript");
  const [themeId, setThemeId] = useState(saved.themeId ?? "github-dark");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(saved.showLineNumbers ?? true);
  const [imageBackground, setImageBackground] = useState(saved.imageBackground ?? "gradient-blue");
  const [imagePadding, setImagePadding] = useState(saved.imagePadding ?? 48);

  const [prettierOpts, setPrettierOpts] = useState<PrettierUserOptions>({
    ...DEFAULT_PRETTIER_OPTIONS,
    ...saved.prettierOpts,
  });
  const [clangOpts, setClangOpts] = useState<ClangUserOptions>({
    ...DEFAULT_CLANG_OPTIONS,
    ...saved.clangOpts,
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const grouped = useMemo(groupLanguages, []);
  const lang = LANGUAGES.find((l) => l.id === langId)!;
  const bgDef = IMAGE_BACKGROUNDS.find((b) => b.id === imageBackground)!;

  // Persist settings
  useEffect(() => {
    saveSettings({ langId, themeId, prettierOpts, clangOpts, showLineNumbers, imageBackground, imagePadding });
  }, [langId, themeId, prettierOpts, clangOpts, showLineNumbers, imageBackground, imagePadding]);

  // Re-highlight when theme changes and there's output
  useEffect(() => {
    if (!output) return;
    let cancelled = false;
    highlightCode(output, lang, themeId).then((html) => {
      if (!cancelled) setHighlightedHtml(html);
    });
    return () => { cancelled = true; };
  }, [themeId, output, lang]);

  /* ── Actions ──────────────────────────────────────────────────── */

  const handleFormat = useCallback(async () => {
    if (!input.trim()) return;
    setFormatting(true);
    setError(null);
    try {
      const result = await formatCode(input, lang, prettierOpts, clangOpts);
      setOutput(result);
      const html = await highlightCode(result, lang, themeId);
      setHighlightedHtml(html);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setOutput("");
      setHighlightedHtml("");
    } finally {
      setFormatting(false);
    }
  }, [input, lang, prettierOpts, clangOpts, themeId]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const handleDownload = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = lang.filename?.split(".").pop() ?? "txt";
    a.download = `formatted.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, lang]);

  const handleDownloadImage = useCallback(async () => {
    if (!imageRef.current || !output) return;
    setExportingImage(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(imageRef.current, {
        pixelRatio: 2,
        skipAutoScale: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `code-${lang.id}.png`;
      a.click();
    } catch (err) {
      console.error("Image export failed:", err);
    } finally {
      setExportingImage(false);
    }
  }, [output, lang.id]);

  const handleLangChange = useCallback(
    (id: string) => {
      const newLang = LANGUAGES.find((l) => l.id === id)!;
      setLangId(id);
      setOutput("");
      setHighlightedHtml("");
      setError(null);
      if (!input.trim()) {
        setInput(newLang.placeholder);
      }
    },
    [input],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const indent = lang.engine === "prettier" && !prettierOpts.useTabs
          ? " ".repeat(prettierOpts.tabWidth)
          : "\t";
        const newVal = ta.value.substring(0, start) + indent + ta.value.substring(end);
        setInput(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + indent.length;
        });
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleFormat();
      }
    },
    [handleFormat, lang.engine, prettierOpts.useTabs, prettierOpts.tabWidth],
  );

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* ── Language + Theme selectors ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Language</label>
          <select
            value={langId}
            onChange={(e) => handleLangChange(e.target.value)}
            className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-teal/40 focus:outline-none focus:ring-1 focus:ring-accent-teal/20 transition-colors"
          >
            {[...grouped.entries()].map(([group, langs]) => (
              <optgroup key={group} label={group}>
                {langs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Theme</label>
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-teal/40 focus:outline-none focus:ring-1 focus:ring-accent-teal/20 transition-colors"
          >
            <optgroup label="Dark">
              {THEMES.filter((t) => t.type === "dark").map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="Light">
              {THEMES.filter((t) => t.type === "light").map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

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
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        Formatting options
        <span className="rounded bg-bg-card px-1.5 py-0.5 text-[10px] text-text-muted">
          {lang.engine === "prettier" ? "Prettier" : "clang-format"}
        </span>
      </button>

      {showOptions && (
        <div className="rounded-lg border border-border-card bg-bg-card/60 p-4">
          {lang.engine === "prettier" ? (
            <PrettierOptionsPanel options={prettierOpts} onChange={setPrettierOpts} />
          ) : (
            <ClangOptionsPanel options={clangOpts} onChange={setClangOpts} />
          )}
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Input</label>
          <span className="text-[10px] text-text-muted">
            {lang.engine === "prettier" ? "Prettier" : "clang-format"} engine
          </span>
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCopied(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={lang.placeholder}
          rows={10}
          className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:outline-none focus:ring-1 focus:ring-accent-teal/20 transition-colors resize-y leading-relaxed"
          spellCheck={false}
        />
      </div>

      {/* ── Format button ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleFormat}
          disabled={formatting || !input.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-teal/15 border border-accent-teal/25 px-4 py-2 text-sm font-medium text-accent-teal transition-all hover:bg-accent-teal/25 disabled:opacity-40 disabled:pointer-events-none"
        >
          {formatting ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Formatting...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              Format Code
            </>
          )}
        </button>
        <span className="text-[10px] text-text-muted hidden sm:inline">
          Ctrl + Enter
        </span>
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <p className="font-medium mb-1">Formatting error</p>
          <pre className="whitespace-pre-wrap text-xs font-mono opacity-80">{error}</pre>
        </div>
      )}

      {/* ── Output ────────────────────────────────────────────────── */}
      {output && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">Formatted output</label>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={exportingImage}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-purple hover:bg-accent-purple/10 disabled:opacity-40"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                {exportingImage ? "Exporting..." : "Image"}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-teal hover:bg-accent-teal/10"
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Syntax-highlighted output */}
          <div
            className="shiki-output w-full rounded-lg border border-border-card overflow-x-auto max-h-[500px] overflow-y-auto [&_pre]:!rounded-lg [&_pre]:!px-4 [&_pre]:!py-3 [&_pre]:!m-0 [&_code]:!text-sm [&_code]:!leading-relaxed [&_code]:!font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />

          {/* ── Image Export Settings ─────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-border-card bg-bg-card/60 p-4 space-y-3">
            <p className="text-xs font-medium text-text-secondary">Image export settings</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <ToggleOption
                label="Line Numbers"
                value={showLineNumbers}
                onChange={setShowLineNumbers}
              />
              <NumberOption
                label="Padding"
                value={imagePadding}
                onChange={setImagePadding}
                min={16}
                max={96}
              />
              <div className="col-span-2 sm:col-span-1">
                <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                  <span className="shrink-0">Background</span>
                  <select
                    value={imageBackground}
                    onChange={(e) => setImageBackground(e.target.value)}
                    className="rounded border border-border-card bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:border-accent-teal/40 focus:outline-none min-w-0"
                  >
                    {IMAGE_BACKGROUNDS.map((b) => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* ── Carbon-style Preview ──────────────────────────────── */}
            <div className="mt-3 overflow-x-auto rounded-lg border border-border-card">
              <div
                ref={imageRef}
                style={{
                  background: bgDef.css,
                  padding: `${imagePadding}px`,
                  minWidth: "fit-content",
                }}
              >
                <div
                  className="rounded-xl overflow-hidden shadow-2xl"
                  style={{ minWidth: "max-content" }}
                >
                  {/* Title bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-3"
                    style={{ background: "rgba(0,0,0,0.3)" }}
                  >
                    <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                    <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                    <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                    <span className="flex-1 text-center text-xs text-white/40 font-mono">
                      {lang.filename ?? `code.${lang.id}`}
                    </span>
                    <span className="w-[52px]" />
                  </div>

                  {/* Code area */}
                  <CodeImageContent
                    code={output}
                    highlightedHtml={highlightedHtml}
                    showLineNumbers={showLineNumbers}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Code image content (for Carbon-style export)                       */
/* ------------------------------------------------------------------ */

/** Inject line number spans into each shiki `<span class="line">` element. */
function injectLineNumbers(html: string): string {
  let lineNum = 0;
  return html.replace(/<span class="line"/g, () => {
    lineNum++;
    return `<span class="line" data-line="${lineNum}"`;
  });
}

function CodeImageContent({
  code,
  highlightedHtml,
  showLineNumbers,
}: {
  code: string;
  highlightedHtml: string;
  showLineNumbers: boolean;
}) {
  const lineCount = code.split("\n").length;
  const gutterChars = String(lineCount).length;

  const finalHtml = showLineNumbers ? injectLineNumbers(highlightedHtml) : highlightedHtml;

  // CSS custom properties to control gutter width in the style block below
  const lineNumStyles = showLineNumbers
    ? `
      .code-image-numbered .line[data-line]::before {
        content: attr(data-line);
        display: inline-block;
        width: ${gutterChars}ch;
        margin-right: 1.5ch;
        text-align: right;
        opacity: 0.25;
        user-select: none;
      }
    `
    : "";

  return (
    <div className={showLineNumbers ? "code-image-numbered" : ""}>
      {lineNumStyles && <style dangerouslySetInnerHTML={{ __html: lineNumStyles }} />}
      <div
        className="[&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!px-5 [&_pre]:!py-4 [&_code]:!text-sm [&_code]:!leading-relaxed [&_code]:!font-mono"
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prettier Options Panel                                             */
/* ------------------------------------------------------------------ */

function PrettierOptionsPanel({
  options,
  onChange,
}: {
  options: PrettierUserOptions;
  onChange: (opts: PrettierUserOptions) => void;
}) {
  const set = <K extends keyof PrettierUserOptions>(key: K, val: PrettierUserOptions[K]) =>
    onChange({ ...options, [key]: val });

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      <NumberOption label="Print Width" value={options.printWidth} onChange={(v) => set("printWidth", v)} min={40} max={200} />
      <NumberOption label="Tab Width" value={options.tabWidth} onChange={(v) => set("tabWidth", v)} min={1} max={16} />
      <ToggleOption label="Use Tabs" value={options.useTabs} onChange={(v) => set("useTabs", v)} />
      <ToggleOption label="Semicolons" value={options.semi} onChange={(v) => set("semi", v)} />
      <ToggleOption label="Single Quotes" value={options.singleQuote} onChange={(v) => set("singleQuote", v)} />
      <SelectOption
        label="Trailing Comma"
        value={options.trailingComma}
        options={["all", "es5", "none"]}
        onChange={(v) => set("trailingComma", v as PrettierUserOptions["trailingComma"])}
      />
      <ToggleOption label="Bracket Spacing" value={options.bracketSpacing} onChange={(v) => set("bracketSpacing", v)} />
      <ToggleOption label="Bracket Same Line" value={options.bracketSameLine} onChange={(v) => set("bracketSameLine", v)} />
      <SelectOption
        label="Arrow Parens"
        value={options.arrowParens}
        options={["always", "avoid"]}
        onChange={(v) => set("arrowParens", v as PrettierUserOptions["arrowParens"])}
      />
      <SelectOption
        label="Prose Wrap"
        value={options.proseWrap}
        options={["always", "never", "preserve"]}
        onChange={(v) => set("proseWrap", v as PrettierUserOptions["proseWrap"])}
      />
      <ToggleOption label="Single Attr / Line" value={options.singleAttributePerLine} onChange={(v) => set("singleAttributePerLine", v)} />
      <SelectOption
        label="End of Line"
        value={options.endOfLine}
        options={["lf", "crlf", "cr", "auto"]}
        onChange={(v) => set("endOfLine", v as PrettierUserOptions["endOfLine"])}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  clang-format Options Panel                                         */
/* ------------------------------------------------------------------ */

function ClangOptionsPanel({
  options,
  onChange,
}: {
  options: ClangUserOptions;
  onChange: (opts: ClangUserOptions) => void;
}) {
  const set = <K extends keyof ClangUserOptions>(key: K, val: ClangUserOptions[K]) =>
    onChange({ ...options, [key]: val });

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      <SelectOption
        label="Base Style"
        value={options.preset}
        options={[...CLANG_PRESETS]}
        onChange={(v) => set("preset", v as ClangUserOptions["preset"])}
      />
      <NumberOption label="Indent Width" value={options.indentWidth} onChange={(v) => set("indentWidth", v)} min={1} max={16} />
      <NumberOption label="Column Limit" value={options.columnLimit} onChange={(v) => set("columnLimit", v)} min={40} max={200} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared option controls                                             */
/* ------------------------------------------------------------------ */

function ToggleOption({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-accent-teal/30" : "bg-bg-secondary border border-border-card"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-transform ${value ? "translate-x-4 bg-accent-teal" : "bg-text-muted/50"}`}
        />
      </button>
    </label>
  );
}

function NumberOption({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded border border-border-card bg-bg-secondary px-2 py-1 text-xs text-text-primary text-right focus:border-accent-teal/40 focus:outline-none"
      />
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
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border-card bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:border-accent-teal/40 focus:outline-none min-w-0"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
