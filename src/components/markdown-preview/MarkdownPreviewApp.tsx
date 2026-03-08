import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  renderMarkdown,
  wordCount,
  charCount,
  lineCount,
  wrapHtmlDocument,
} from "../../lib/markdown";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SAMPLE_MARKDOWN = `# Hello, Markdown!

This is a **live preview** of your Markdown. Start typing on the left to see it rendered here.

## Features

- **Bold**, *italic*, ~~strikethrough~~, and \`inline code\`
- [Links](https://example.com) and images
- Tables, blockquotes, and task lists

## Code Block

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Table

| Feature | Supported |
|---------|-----------|
| GFM     | Yes       |
| Tables  | Yes       |
| Tasks   | Yes       |

## Task List

- [x] Write Markdown
- [x] Preview in real-time
- [ ] Export to HTML

> "Markdown is intended to be as easy-to-read and easy-to-write as is feasible."
> — John Gruber
`;

type ViewMode = "split" | "editor" | "preview";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MarkdownPreviewApp() {
  const [source, setSource] = useState(SAMPLE_MARKDOWN);
  const [copied, setCopied] = useState<"md" | "html" | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Derived state ───────────────────────────────────────────── */

  const html = useMemo(() => renderMarkdown(source), [source]);
  const stats = useMemo(
    () => ({
      words: wordCount(source),
      chars: charCount(source),
      lines: lineCount(source),
    }),
    [source],
  );

  /* ── Sync scroll positions ───────────────────────────────────── */

  const handleEditorScroll = useCallback(() => {
    if (viewMode !== "split" || !textareaRef.current || !previewRef.current) return;
    const ta = textareaRef.current;
    const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
    const preview = previewRef.current;
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  }, [viewMode]);

  /* ── Actions ─────────────────────────────────────────────────── */

  const handleCopyMarkdown = useCallback(() => {
    navigator.clipboard.writeText(source).then(() => {
      setCopied("md");
      setTimeout(() => setCopied(null), 1500);
    });
  }, [source]);

  const handleCopyHtml = useCallback(() => {
    navigator.clipboard.writeText(html).then(() => {
      setCopied("html");
      setTimeout(() => setCopied(null), 1500);
    });
  }, [html]);

  const handleDownloadHtml = useCallback(() => {
    const doc = wrapHtmlDocument(html);
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [html]);

  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [source]);

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View mode tabs */}
        <div className="inline-flex rounded-lg border border-border-card bg-bg-secondary p-0.5">
          {(["split", "editor", "preview"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-accent-cyan/15 text-accent-cyan"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {mode === "split" ? "Split" : mode === "editor" ? "Editor" : "Preview"}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary"
          >
            {copied === "md" ? (
              <CheckIcon />
            ) : (
              <ClipboardIcon />
            )}
            {copied === "md" ? "Copied" : "Copy MD"}
          </button>
          <button
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary"
          >
            {copied === "html" ? (
              <CheckIcon />
            ) : (
              <ClipboardIcon />
            )}
            {copied === "html" ? "Copied" : "Copy HTML"}
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary"
          >
            <DownloadIcon />
            .md
          </button>
          <button
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-cyan hover:bg-accent-cyan/10"
          >
            <DownloadIcon />
            .html
          </button>
        </div>
      </div>

      {/* ── Editor + Preview panes ──────────────────────────────── */}
      <div
        className={`grid gap-4 ${
          viewMode === "split"
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1"
        }`}
        style={{ minHeight: "32rem" }}
      >
        {/* Editor */}
        {viewMode !== "preview" && (
          <div className="flex flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Markdown</label>
              <span className="text-[10px] text-text-muted">
                {stats.words} words &middot; {stats.lines} lines
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onScroll={handleEditorScroll}
              placeholder="Type or paste your Markdown here..."
              className="flex-1 w-full rounded-lg border border-border-card bg-bg-secondary px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition-colors resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview */}
        {viewMode !== "editor" && (
          <div className="flex flex-col">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Preview</label>
              <span className="text-[10px] text-text-muted">
                {stats.chars} characters
              </span>
            </div>
            <div
              ref={previewRef}
              className="markdown-preview flex-1 w-full rounded-lg border border-border-card bg-bg-card/60 px-5 py-4 text-sm text-text-primary overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function ClipboardIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
