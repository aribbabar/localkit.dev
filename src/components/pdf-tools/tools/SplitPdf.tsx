import { useState } from "react";
import type { ConvertedFile } from "../../../lib/mupdf";
import {
  PdfDropZone,
  ProgressBar,
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

type SplitMode = "range" | "every" | "each";

export default function SplitPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [splitMode, setSplitMode] = useState<SplitMode>("each");
  const [rangeInput, setRangeInput] = useState("");
  const [everyN, setEveryN] = useState(1);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFile(files: File[]) {
    if (!files.length) return;
    const f = files[0];
    setFile(f);
    setResults([]);

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
    setResults([]);
  }

  async function split() {
    if (!file || !pageCount || isProcessing) return;

    setIsProcessing(true);
    setResults([]);

    try {
      const lib = await getMupdf();
      let ranges: number[][];

      if (splitMode === "each") {
        ranges = Array.from({ length: pageCount }, (_, i) => [i]);
      } else if (splitMode === "every") {
        ranges = lib.splitEveryNPages(pageCount, Math.max(1, everyN));
      } else {
        const indices = lib.parsePageRange(rangeInput, pageCount);
        if (!indices.length) {
          alert("No valid pages in the specified range.");
          setIsProcessing(false);
          return;
        }
        ranges = [indices];
      }

      setProgress({ done: 0, total: ranges.length });
      const output = await lib.splitPdf(file, ranges, (done, total) =>
        setProgress({ done, total })
      );
      setResults(output);
    } catch (err: any) {
      alert(`Split error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function downloadAll() {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of results) zip.file(f.name, f.buffer);
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "localkit-split-pdfs.zip");
    } catch (err: any) {
      alert(`Zip error: ${err?.message ?? String(err)}`);
    } finally {
      setIsZipping(false);
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
            Split a PDF into multiple files
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

          {/* Split mode selector */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">
              Split Mode
            </h3>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="splitMode"
                  value="each"
                  checked={splitMode === "each"}
                  onChange={() => setSplitMode("each")}
                  className="accent-accent-red"
                />
                <span className="text-xs text-text-secondary">
                  Split into individual pages
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="splitMode"
                  value="every"
                  checked={splitMode === "every"}
                  onChange={() => setSplitMode("every")}
                  className="accent-accent-red"
                />
                <span className="text-xs text-text-secondary">
                  Split every
                </span>
                {splitMode === "every" && (
                  <input
                    type="number"
                    min="1"
                    max={pageCount}
                    value={everyN}
                    onChange={(e) =>
                      setEveryN(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-16 rounded-lg border border-border-card bg-bg-secondary px-2 py-1 text-xs text-text-primary outline-none focus:border-border-card-hover"
                  />
                )}
                {splitMode === "every" && (
                  <span className="text-xs text-text-secondary">page(s)</span>
                )}
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="splitMode"
                  value="range"
                  checked={splitMode === "range"}
                  onChange={() => setSplitMode("range")}
                  className="accent-accent-red"
                />
                <span className="text-xs text-text-secondary">
                  Extract page range
                </span>
              </label>

              {splitMode === "range" && (
                <input
                  type="text"
                  placeholder="e.g. 1-3, 5, 7-10"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                />
              )}
            </div>

            <ActionButton
              onClick={split}
              loading={isProcessing}
              label="Split PDF"
              loadingLabel="Splitting..."
            />
          </div>
        </>
      )}

      {isProcessing && (
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="Splitting PDF..."
        />
      )}

      {results.length > 0 && (
        <ResultsList
          files={results}
          onDownload={(i) => downloadBlob(results[i].blob, results[i].name)}
          onDownloadAll={downloadAll}
          isZipping={isZipping}
        />
      )}
    </div>
  );
}
