import { useState } from "react";
import type { ConvertedFile, ImageFormat } from "../../../lib/mupdf";
import styles from "../PdfToolsApp.module.css";
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

const DPI_OPTIONS = [
  { value: 72, label: "72 DPI (screen)" },
  { value: 150, label: "150 DPI (default)" },
  { value: 300, label: "300 DPI (print)" },
  { value: 600, label: "600 DPI (high quality)" },
];

export default function PdfToImages() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(85);
  const [pageRange, setPageRange] = useState("");
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

  async function convert() {
    if (!file || !pageCount || isProcessing) return;

    setIsProcessing(true);
    setResults([]);

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

      setProgress({ done: 0, total: indices?.length ?? pageCount });
      const output = await lib.pdfToImages(
        file,
        format,
        dpi,
        quality,
        indices,
        (done, total) => setProgress({ done, total })
      );
      setResults(output);
    } catch (err: any) {
      alert(`Conversion error: ${err?.message ?? String(err)}`);
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
      downloadBlob(blob, `localkit-pdf-images.zip`);
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
            Convert PDF pages to PNG or JPEG images
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
              Conversion Settings
            </h3>

            <div className="space-y-4">
              {/* Format */}
              <div>
                <label
                  htmlFor="img-format"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Image Format
                </label>
                <select
                  id="img-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ImageFormat)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                >
                  <option value="png">PNG (lossless)</option>
                  <option value="jpeg">JPEG (lossy, smaller)</option>
                </select>
              </div>

              {/* DPI */}
              <div>
                <label
                  htmlFor="dpi-select"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Resolution (DPI)
                </label>
                <select
                  id="dpi-select"
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                >
                  {DPI_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* JPEG quality */}
              {format === "jpeg" && (
                <div>
                  <label
                    htmlFor="jpeg-quality"
                    className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary"
                  >
                    <span>Quality</span>
                    <span className="font-mono text-text-muted">
                      {quality}%
                    </span>
                  </label>
                  <input
                    type="range"
                    id="jpeg-quality"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className={`${styles.qualityRange} w-full`}
                  />
                </div>
              )}

              {/* Page range */}
              <div>
                <label
                  htmlFor="page-range"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Page Range{" "}
                  <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  id="page-range"
                  placeholder={`e.g. 1-3, 5  (all ${pageCount} pages if empty)`}
                  value={pageRange}
                  onChange={(e) => setPageRange(e.target.value)}
                  className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                />
              </div>
            </div>

            <ActionButton
              onClick={convert}
              loading={isProcessing}
              label="Convert to Images"
              loadingLabel="Converting..."
            />
          </div>
        </>
      )}

      {isProcessing && (
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="Converting pages..."
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
