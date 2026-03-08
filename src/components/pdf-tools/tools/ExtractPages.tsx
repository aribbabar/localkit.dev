import { useState } from "react";
import type { ConvertedFile } from "../../../lib/mupdf";
import {
  PdfDropZone,
  ResultsList,
  ActionButton,
  downloadBlob,
  formatSize,
} from "../shared";

let mupdfLib: typeof import("../../../lib/mupdf") | null = null;
async function getMupdf() {
  if (!mupdfLib) mupdfLib = await import("../../../lib/mupdf");
  return mupdfLib;
}

export default function ExtractPages() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rangeInput, setRangeInput] = useState("");
  const [result, setResult] = useState<ConvertedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleFile(files: File[]) {
    if (!files.length) return;
    const f = files[0];
    setFile(f);
    setResult(null);

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
    setResult(null);
  }

  async function extract() {
    if (!file || !pageCount || isProcessing || !rangeInput.trim()) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const lib = await getMupdf();
      const indices = lib.parsePageRange(rangeInput, pageCount);

      if (!indices.length) {
        alert("No valid pages in the specified range.");
        setIsProcessing(false);
        return;
      }

      const output = await lib.extractPages(file, indices);
      setResult(output);
    } catch (err: any) {
      alert(`Extract error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
    }
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
            Extract specific pages into a new PDF
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

          {/* Page range input */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">
              Pages to Extract
            </h3>

            <div>
              <label
                htmlFor="extract-range"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Page Range
              </label>
              <input
                type="text"
                id="extract-range"
                placeholder={`e.g. 1-3, 5, 7-10  (total: ${pageCount} pages)`}
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
              />
            </div>

            <ActionButton
              onClick={extract}
              loading={isProcessing}
              label="Extract Pages"
              loadingLabel="Extracting..."
              disabled={!rangeInput.trim()}
            />
          </div>
        </>
      )}

      {result && (
        <ResultsList
          files={[result]}
          onDownload={() => downloadBlob(result.blob, result.name)}
          onDownloadAll={() => downloadBlob(result.blob, result.name)}
        />
      )}
    </div>
  );
}
