import { useState, type ChangeEvent, type DragEvent } from "react";
import {
  isAcceptedSvgFile,
  optimizeSvgBatch,
  type OptimizedSvgResult,
} from "../../lib/svg-optimizer";

type ViewMode = "optimized" | "original";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPercent(value: number) {
  return value < 1 ? value.toFixed(1) : Math.round(value).toString();
}

export default function SvgOptimizerTool() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [optimizedResults, setOptimizedResults] = useState<
    OptimizedSvgResult[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("optimized");
  const [progress, setProgress] = useState({
    fileIndex: 0,
    fileProgress: 0,
    total: 0,
  });

  const hasFiles = selectedFiles.length > 0;
  const hasResults = optimizedResults.length > 0;
  const previewFile = selectedFiles[previewIndex] ?? null;
  const previewResult = optimizedResults[previewIndex] ?? null;
  const successCount = optimizedResults.filter(
    (result) => !result.error,
  ).length;
  const failCount = optimizedResults.length - successCount;
  const totalBytesSaved = optimizedResults.reduce(
    (sum, result) => sum + result.bytesSaved,
    0,
  );
  const totalOriginalBytes = optimizedResults.reduce(
    (sum, result) => sum + result.originalBytes,
    0,
  );
  const totalSavedPercent =
    totalOriginalBytes > 0 ? (totalBytesSaved / totalOriginalBytes) * 100 : 0;
  const progressPercent = progress.total
    ? Math.round(
        ((progress.fileIndex + progress.fileProgress) / progress.total) * 100,
      )
    : 0;

  function addFiles(files: File[]) {
    const nextFiles = files.filter(isAcceptedSvgFile);
    if (!nextFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...nextFiles]);
    setOptimizedResults([]);
    setPreviewIndex(0);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
      event.target.value = "";
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
    setOptimizedResults([]);
    setPreviewIndex(0);
  }

  function clearFiles() {
    setSelectedFiles([]);
    setOptimizedResults([]);
    setPreviewIndex(0);
    setProgress({ fileIndex: 0, fileProgress: 0, total: 0 });
  }

  async function optimizeFiles() {
    if (!selectedFiles.length || isOptimizing) return;

    setIsOptimizing(true);
    setOptimizedResults([]);
    setProgress({ fileIndex: 0, fileProgress: 0, total: selectedFiles.length });

    try {
      const results = await optimizeSvgBatch(
        selectedFiles,
        (fileIndex, fileProgress, totalFiles) =>
          setProgress({ fileIndex, fileProgress, total: totalFiles }),
      );
      setOptimizedResults(results);
      const firstSuccess = results.findIndex((result) => !result.error);
      setPreviewIndex(firstSuccess >= 0 ? firstSuccess : 0);
      if (firstSuccess >= 0) {
        setViewMode("optimized");
      }
    } catch (err: unknown) {
      alert(
        `Optimization error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsOptimizing(false);
    }
  }

  function downloadFile(result: OptimizedSvgResult) {
    if (result.error) return;

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    const successfulResults = optimizedResults.filter(
      (result) => !result.error,
    );
    if (!successfulResults.length || isZipping) return;

    if (successfulResults.length === 1) {
      downloadFile(successfulResults[0]);
      return;
    }

    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const result of successfulResults) {
        zip.file(result.name, result.buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "localkit-optimized-svg.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`ZIP error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsZipping(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div className="space-y-6">
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
            isDragging
              ? "border-accent-cyan bg-accent-cyan/5"
              : "border-border-card hover:border-border-card-hover"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".svg,image/svg+xml"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={handleFileInputChange}
          />

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-cyan/20 bg-accent-cyan/10">
            <svg
              className="h-7 w-7 text-accent-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <p className="font-display text-sm font-semibold text-text-primary">
            Drop SVG files here or{" "}
            <span className="text-accent-cyan">browse</span>
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            Optimize one file or batch-process a whole set locally
          </p>
        </div>

        {hasFiles && previewFile && (
          <div className="overflow-hidden rounded-xl border border-border-card bg-bg-card">
            <div className="flex items-center justify-between border-b border-border-card px-4 py-2">
              <div className="flex items-center gap-2">
                {(["optimized", "original"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                      viewMode === mode
                        ? "border border-accent-cyan/25 bg-accent-cyan/15 text-accent-cyan"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {mode === "optimized" ? "Optimized" : "Original"}
                  </button>
                ))}
              </div>
              <div className="text-right">
                <p className="max-w-44 truncate text-[10px] font-medium text-text-secondary">
                  {previewFile.name}
                </p>
                <p className="text-[10px] text-text-muted">
                  {previewResult?.error
                    ? "Optimization failed"
                    : previewResult
                      ? `${formatSize(previewResult.originalBytes)} to ${formatSize(previewResult.optimizedBytes)}`
                      : "Run the optimizer to inspect cleaned markup"}
                </p>
              </div>
            </div>

            <div className="bg-bg-primary/40 p-4">
              {previewResult?.error ? (
                <div className="flex max-w-sm flex-col items-center gap-2 p-6 text-center">
                  <svg
                    className="h-8 w-8 text-accent-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  <p className="text-xs font-medium text-accent-red">
                    Optimization failed
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {previewResult.error}
                  </p>
                </div>
              ) : viewMode === "original" ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
                    Original
                  </p>
                  <CodePanel code={previewResult?.originalSvgString ?? ""} />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent-cyan">
                    Optimized
                  </p>
                  <CodePanel code={previewResult?.svgString ?? ""} />
                </div>
              )}
            </div>
          </div>
        )}

        {isOptimizing && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                Optimizing...
              </span>
              <span className="font-mono text-xs text-text-muted">
                {Math.min(progress.fileIndex + 1, progress.total)}/
                {progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent-cyan transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {hasResults && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-accent-cyan">
                  Optimization complete
                </h3>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  Saved {formatSize(totalBytesSaved)} across {successCount} file
                  {successCount === 1 ? "" : "s"}
                  {successCount > 0
                    ? ` (${formatPercent(totalSavedPercent)}%)`
                    : ""}
                </p>
                {failCount > 0 && (
                  <p className="mt-0.5 text-[10px] text-accent-red">
                    {failCount} file{failCount === 1 ? "" : "s"} failed
                  </p>
                )}
              </div>
              {successCount > 0 && (
                <button
                  type="button"
                  onClick={downloadAll}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan transition-all hover:bg-accent-cyan/20 disabled:pointer-events-none disabled:opacity-50"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {isZipping
                    ? "Zipping..."
                    : successCount > 1
                      ? "Download ZIP"
                      : "Download"}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {optimizedResults.map((result, index) => (
                <div
                  key={`${result.name}-${index}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    result.error
                      ? previewIndex === index
                        ? "border-accent-red/30 bg-accent-red/5"
                        : "border-accent-red/20 bg-accent-red/5 hover:bg-accent-red/10"
                      : previewIndex === index
                        ? "border-accent-cyan/30 bg-accent-cyan/5"
                        : "border-accent-cyan/20 bg-accent-cyan/5 hover:bg-accent-cyan/10"
                  }`}
                  onClick={() => setPreviewIndex(index)}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                      result.error ? "bg-accent-red/10" : "bg-accent-cyan/10"
                    }`}
                  >
                    {result.error ? (
                      <svg
                        className="h-4 w-4 text-accent-red"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4 text-accent-cyan"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {result.name}
                    </p>
                    {result.error ? (
                      <p
                        className="truncate text-[10px] text-accent-red"
                        title={result.error}
                      >
                        Failed
                      </p>
                    ) : (
                      <p className="text-[10px] text-text-muted">
                        {formatSize(result.originalBytes)}
                        <span className="mx-1 text-text-muted/60">&rarr;</span>
                        {formatSize(result.optimizedBytes)}
                        <span className="mx-1 text-text-muted/60">•</span>
                        saved {formatPercent(result.savedPercent)}%
                      </p>
                    )}
                  </div>
                  {!result.error && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadFile(result);
                      }}
                      className="shrink-0 rounded-md border border-accent-cyan/30 bg-accent-cyan/10 px-2 py-1 text-[10px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20"
                    >
                      Save
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border-card bg-bg-card p-5">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Clean SVG markup without changing the artwork
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            This tool runs <code>svgtidy</code> locally in your browser to strip
            comments, metadata, hidden elements, and other redundant markup.
          </p>
          <ul className="mt-4 space-y-2 text-[11px] text-text-secondary">
            <li>Batch optimize multiple SVG files in one pass.</li>
            <li>Inspect the cleaned SVG code before downloading.</li>
            <li>Download one file or package the whole batch as a ZIP.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-border-card bg-bg-card p-5">
          <div className="mb-4">
            <p className="text-xs font-medium text-text-secondary">
              Selected files
            </p>
            <p className="mt-0.5 text-[10px] text-text-muted">
              {selectedFiles.length
                ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready`
                : "Add SVG files to begin"}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={optimizeFiles}
              disabled={!selectedFiles.length || isOptimizing}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2.5 text-sm font-semibold text-accent-cyan transition-all hover:bg-accent-cyan/20 disabled:pointer-events-none disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 3.75V18m0 0l3.75-3.75M16.5 18l-3.75-3.75M7.5 20.25V6m0 0L3.75 9.75M7.5 6l3.75 3.75"
                />
              </svg>
              {isOptimizing ? "Optimizing..." : "Optimize with svgtidy"}
            </button>

            <button
              type="button"
              onClick={clearFiles}
              disabled={!selectedFiles.length}
              className="w-full rounded-lg border border-border-card bg-bg-secondary px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
            >
              Clear files
            </button>
          </div>

          {previewResult && !previewResult.error && (
            <div className="mt-5 rounded-lg border border-accent-cyan/20 bg-accent-cyan/5 p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-accent-cyan">
                Selected Result
              </p>
              <div className="mt-3 space-y-2 text-xs text-text-secondary">
                <div className="flex items-center justify-between gap-3">
                  <span>Original size</span>
                  <span className="font-mono text-text-primary">
                    {formatSize(previewResult.originalBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Optimized size</span>
                  <span className="font-mono text-text-primary">
                    {formatSize(previewResult.optimizedBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Saved</span>
                  <span className="font-mono text-accent-cyan">
                    {formatSize(previewResult.bytesSaved)} (
                    {formatPercent(previewResult.savedPercent)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
                    previewIndex === index
                      ? "border-accent-cyan/30 bg-accent-cyan/5"
                      : "border-border-card bg-bg-secondary"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-medium text-text-primary">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {formatSize(file.size)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-card hover:text-text-primary"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CodePanel({ code }: { code: string }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-lg border border-border-card bg-bg-secondary p-4 font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre-wrap break-all">
      {code}
    </pre>
  );
}
