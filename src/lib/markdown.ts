import { marked } from "marked";

/* ------------------------------------------------------------------ */
/*  Configure marked with GFM defaults                                 */
/* ------------------------------------------------------------------ */

marked.setOptions({
  gfm: true,
  breaks: true,
});

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Parse Markdown string to HTML. */
export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false }) as string;
}

/** Word count from raw Markdown text. */
export function wordCount(source: string): number {
  const trimmed = source.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Character count (excluding leading/trailing whitespace). */
export function charCount(source: string): number {
  return source.length;
}

/** Line count. */
export function lineCount(source: string): number {
  if (!source) return 0;
  return source.split("\n").length;
}

/** Wrap rendered HTML in a minimal standalone document. */
export function wrapHtmlDocument(html: string, title = "Markdown Preview"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
  pre { background: #f5f5f5; padding: 1rem; border-radius: 0.375rem; overflow-x: auto; }
  code { font-family: "JetBrains Mono", monospace; font-size: 0.875em; }
  :not(pre) > code { background: #f0f0f0; padding: 0.15em 0.35em; border-radius: 0.25rem; }
  blockquote { border-left: 3px solid #d0d0d0; margin-left: 0; padding-left: 1rem; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f5f5f5; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
  input[type="checkbox"] { margin-right: 0.35rem; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}
