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

export default function CompressPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConvertedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleFile(files: File[]) {
    if (!files.length) return;
    setFile(files[0]);
    setResult(null);
  }

  function clearAll() {
    setFile(null);
    setResult(null);
  }

  async function compress() {
    if (!file || isProcessing) return;

    setIsProcessing(true);
    setResult(null);

    try {
      const { compressPdf } = await getMupdf();
      const output = await compressPdf(file);
      setResult(output);
    } catch (err: any) {
      alert(`Compress error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  const savings =
    file && result
      ? ((1 - result.buffer.byteLength / file.size) * 100).toFixed(1)
      : null;

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
            Compress and optimize PDF file size
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
                  Original size: {formatSize(file.size)}
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

          {/* Compress info */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-3 text-sm font-semibold text-text-primary">
              Compression
            </h3>
            <p className="text-xs text-text-muted">
              Removes unused objects, compresses streams, and linearizes the PDF
              for faster web loading. Lossless — no quality reduction.
            </p>

            {!result && (
              <ActionButton
                onClick={compress}
                loading={isProcessing}
                label="Compress PDF"
                loadingLabel="Compressing..."
              />
            )}
          </div>
        </>
      )}

      {result && (
        <>
          {/* Size comparison */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-text-muted">Original</p>
                <p className="font-mono text-sm font-semibold text-text-primary">
                  {formatSize(file!.size)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Compressed</p>
                <p className="font-mono text-sm font-semibold text-accent-green">
                  {formatSize(result.buffer.byteLength)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Savings</p>
                <p
                  className={`font-mono text-sm font-semibold ${
                    Number(savings) > 0
                      ? "text-accent-green"
                      : "text-text-muted"
                  }`}
                >
                  {Number(savings) > 0 ? `${savings}%` : "No reduction"}
                </p>
              </div>
            </div>
          </div>

          <ResultsList
            files={[result]}
            onDownload={() => downloadBlob(result.blob, result.name)}
            onDownloadAll={() => downloadBlob(result.blob, result.name)}
          />
        </>
      )}
    </div>
  );
}
