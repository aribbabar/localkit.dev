import { useState } from "react";
import {
  PdfDropZone,
  ActionButton,
  ProgressBar,
  ResultsList,
  downloadBlob,
  formatSize,
} from "../shared";

let mupdfLib: typeof import("../../../lib/mupdf") | null = null;
async function getMupdf() {
  if (!mupdfLib) mupdfLib = await import("../../../lib/mupdf");
  return mupdfLib;
}

export default function PdfToWord() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageRange, setPageRange] = useState("");
  const [result, setResult] = useState<{
    name: string;
    blob: Blob;
    buffer: ArrayBuffer;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

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
    setProgress({ done: 0, total: 0 });
  }

  async function convert() {
    if (!file || !pageCount || isProcessing) return;

    setIsProcessing(true);
    setResult(null);

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

      const total = indices?.length ?? pageCount;
      setProgress({ done: 0, total });

      const converted = await lib.pdfToDocx(file, indices, (done, t) => {
        setProgress({ done, total: t });
      });

      setResult(converted);
    } catch (err: any) {
      alert(`Conversion error: ${err?.message ?? String(err)}`);
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
            Convert PDF to Word document (.docx)
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

            <div>
              <label
                htmlFor="word-page-range"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Page Range{" "}
                <span className="text-text-muted">(optional)</span>
              </label>
              <input
                type="text"
                id="word-page-range"
                placeholder={`e.g. 1-3, 5  (all ${pageCount} pages if empty)`}
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
              />
            </div>

            <p className="mt-3 text-[11px] text-text-muted">
              Preserves text formatting (bold, italic, font sizes) and embedded
              images. Complex layouts may be approximated.
            </p>

            {!result && (
              <ActionButton
                onClick={convert}
                loading={isProcessing}
                label="Convert to Word"
                loadingLabel="Converting..."
              />
            )}
          </div>
        </>
      )}

      {isProcessing && progress.total > 0 && (
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="Converting pages..."
        />
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
