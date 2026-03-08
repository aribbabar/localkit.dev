import { useState } from "react";
import {
  PdfDropZone,
  ActionButton,
  downloadBlob,
  formatSize,
} from "../shared";

let mupdfLib: typeof import("../../../lib/mupdf") | null = null;
async function getMupdf() {
  if (!mupdfLib) mupdfLib = await import("../../../lib/mupdf");
  return mupdfLib;
}

type OutputMode = "text" | "html";

export default function PdfToText() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [pageRange, setPageRange] = useState("");
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleFile(files: File[]) {
    if (!files.length) return;
    const f = files[0];
    setFile(f);
    setExtractedText(null);

    try {
      const { getPdfInfo } = await getMupdf();
      const info = await getPdfInfo(f);
      setPageCount(info.pageCount);
    } catch (err: any) {
      alert(`Error reading PDF: ${err?.message ?? String(err)}`);
      setFile(null);
    }
  }

  function clearAll() {
    setFile(null);
    setPageCount(0);
    setExtractedText(null);
  }

  async function extract() {
    if (!file || !pageCount || isProcessing) return;

    setIsProcessing(true);
    setExtractedText(null);

    try {
      const lib = await getMupdf();
      let indices: number[] | undefined;

      if (pageRange.trim()) {
        indices = lib.parsePageRange(pageRange, pageCount);
        if (!indices.length) {
          alert("No valid pages in the specified range.");
          setIsProcessing(false);
          return;
        }
      }

      const result =
        outputMode === "html"
          ? await lib.pdfToHtml(file, indices)
          : await lib.pdfToText(file, indices);

      setExtractedText(result);
    } catch (err: any) {
      alert(`Extraction error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function copyToClipboard() {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  function downloadText() {
    if (!extractedText || !file) return;
    const ext = outputMode === "html" ? "html" : "txt";
    const mime =
      outputMode === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    const baseName = file.name.replace(/\.pdf$/i, "");
    const blob = new Blob([extractedText], { type: mime });
    downloadBlob(blob, `${baseName}.${ext}`);
  }

  return (
    <div className="space-y-6">
      {!file ? (
        <PdfDropZone
          onFiles={handleFile}
          multiple={false}
          label="Drop a PDF file here"
          hint="or click to browse"
        >
          <p className="mt-1.5 text-xs text-text-muted">
            Extract text or HTML from PDF pages
          </p>
        </PdfDropZone>
      ) : (
        <>
          {/* File info */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatSize(file.size)} &middot; {pageCount} page
                  {pageCount !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-text-muted transition-colors hover:text-accent-red"
              >
                Change file
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">
              Extraction Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="output-mode"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Output Format
                </label>
                <select
                  id="output-mode"
                  value={outputMode}
                  onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                >
                  <option value="text">Plain Text</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="text-page-range"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Page Range{" "}
                  <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  id="text-page-range"
                  placeholder={`e.g. 1-3, 5  (all ${pageCount} pages if empty)`}
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                />
              </div>
            </div>

            {!extractedText && (
              <ActionButton
                onClick={extract}
                loading={isProcessing}
                label="Extract Text"
                loadingLabel="Extracting..."
              />
            )}
          </div>
        </>
      )}

      {extractedText !== null && (
        <div className="rounded-xl border border-border-card bg-bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-accent-green">
              Extracted Content
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-card bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-border-card-hover"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={downloadText}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-all hover:bg-accent-green/20"
              >
                Download .{outputMode === "html" ? "html" : "txt"}
              </button>
            </div>
          </div>

          <pre className="max-h-96 overflow-auto rounded-lg bg-bg-secondary p-4 text-xs leading-relaxed text-text-secondary">
            {extractedText || "(No text content found)"}
          </pre>
        </div>
      )}
    </div>
  );
}
