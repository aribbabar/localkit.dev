import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  convertBatch,
  convertFile,
  extractImageData,
  POTRACE_PRESETS,
  POTRACE_PREVIEW_MAX_DIM,
  type PotraceOptions,
  type PotracePresetId,
  type SvgResult,
} from "../../lib/image-to-svg";
import {
  DEFAULT_IMAGE_TO_SVG_PREFERENCES,
  loadImageToSvgPreferences,
  saveImageToSvgPreferences,
} from "./preferences";
import styles from "./ImageToSvgTool.module.css";

const ACCEPTED_INPUTS =
  "image/png,image/jpeg,image/gif,image/bmp,image/webp,image/tiff";

function isAcceptedImage(file: File) {
  return file.type.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toSvgName(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${baseName}.svg`;
}

type BgMode = "dark" | "light" | "checker";
type ViewMode = "svg" | "original" | "side-by-side";

const LIVE_PREVIEW_DEBOUNCE_MS = 300;

const BG_STYLES: Record<BgMode, React.CSSProperties> = {
  dark: { backgroundColor: "#0c0c1d" },
  light: { backgroundColor: "#ffffff" },
  checker: {
    backgroundImage:
      "linear-gradient(45deg, #1a1b3e 25%, transparent 25%), linear-gradient(-45deg, #1a1b3e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1b3e 75%), linear-gradient(-45deg, transparent 75%, #1a1b3e 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
    backgroundColor: "#0f1029",
  },
};

const TURN_POLICY_LABELS = [
  "Black",
  "White",
  "Left",
  "Right",
  "Minority",
  "Majority",
  "Random",
];

const POTRACE_PRESET_IDS = Object.keys(POTRACE_PRESETS) as PotracePresetId[];

function matchesPreset<T extends Record<string, string | number | boolean>>(
  options: T,
  presetOptions: T,
) {
  return Object.keys(presetOptions).every(
    (key) => options[key as keyof T] === presetOptions[key as keyof T],
  );
}

export default function ImageToSvgTool() {
  const savedPreferences = useMemo(loadImageToSvgPreferences, []);

  // File state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [convertedResults, setConvertedResults] = useState<SvgResult[]>([]);

  // Settings
  const [potraceOpts, setPotraceOpts] = useState<PotraceOptions>(
    savedPreferences.potrace,
  );

  // UI states
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState({
    fileIndex: 0,
    fileProgress: 0,
    total: 0,
  });

  // Preview
  const [previewIndex, setPreviewIndex] = useState(0);
  const [bgMode, setBgMode] = useState<BgMode>("checker");
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>("svg");
  const [livePreviewResult, setLivePreviewResult] = useState<SvgResult | null>(
    null,
  );
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [svgBlobUrl, setSvgBlobUrl] = useState<string | null>(null);
  const [originalBlobUrl, setOriginalBlobUrl] = useState<string | null>(null);
  const previewImageDataCacheRef = useRef(
    new WeakMap<File, Promise<ImageData>>(),
  );
  const previewRequestIdRef = useRef(0);
  const deferredPotraceOpts = useDeferredValue(potraceOpts);
  const hasFiles = selectedFiles.length > 0;
  const hasResults = convertedResults.length > 0;
  const previewFile = selectedFiles[previewIndex] ?? null;
  const previewResult = livePreviewResult;
  const currentPotracePreset =
    POTRACE_PRESET_IDS.find((presetId) =>
      matchesPreset(potraceOpts, POTRACE_PRESETS[presetId].options),
    ) ?? "custom";

  // Save preferences
  useEffect(() => {
    saveImageToSvgPreferences({
      potrace: potraceOpts,
    });
  }, [potraceOpts]);

  // Build preview blob URLs
  useEffect(() => {
    if (!previewResult || previewResult.error) {
      setSvgBlobUrl(null);
      return;
    }

    const url = URL.createObjectURL(previewResult.blob);
    setSvgBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewResult]);

  useEffect(() => {
    if (!previewFile) {
      setOriginalBlobUrl(null);
      return;
    }

    const url = URL.createObjectURL(previewFile);
    setOriginalBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewFile]);

  useEffect(() => {
    setLivePreviewResult(null);
    setIsPreviewRendering(false);
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) {
      previewRequestIdRef.current += 1;
      setIsPreviewRendering(false);
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    const timerId = window.setTimeout(async () => {
      setIsPreviewRendering(true);

      try {
        let imageDataPromise =
          previewImageDataCacheRef.current.get(previewFile);
        if (!imageDataPromise) {
          imageDataPromise = extractImageData(
            previewFile,
            POTRACE_PREVIEW_MAX_DIM,
          );
          previewImageDataCacheRef.current.set(previewFile, imageDataPromise);
        }

        const imageData = await imageDataPromise;
        const result = await convertFile(previewFile, deferredPotraceOpts, {
          imageData,
        });

        if (previewRequestIdRef.current !== requestId) return;

        startTransition(() => {
          setLivePreviewResult(result);
        });
      } catch (err) {
        previewImageDataCacheRef.current.delete(previewFile);
        if (previewRequestIdRef.current !== requestId) return;

        const message = err instanceof Error ? err.message : String(err);
        startTransition(() => {
          setLivePreviewResult({
            name: toSvgName(previewFile.name),
            svgString: "",
            blob: new Blob([], { type: "image/svg+xml" }),
            buffer: new ArrayBuffer(0),
            error: message,
          });
        });
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setIsPreviewRendering(false);
        }
      }
    }, LIVE_PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [deferredPotraceOpts, previewFile]);

  // ── File handling ────────────────────────────────────────────────────

  function addFiles(files: File[]) {
    const nextFiles = files.filter(isAcceptedImage);
    if (!nextFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...nextFiles]);
    setConvertedResults([]);
    setPreviewIndex(0);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setConvertedResults([]);
    setPreviewIndex(0);
  }

  function clearFiles() {
    setSelectedFiles([]);
    setConvertedResults([]);
    setPreviewIndex(0);
    setProgress({ fileIndex: 0, fileProgress: 0, total: 0 });
  }

  // ── Conversion ───────────────────────────────────────────────────────

  async function convertFiles() {
    if (!selectedFiles.length || isConverting) return;

    setIsConverting(true);
    setProgress({ fileIndex: 0, fileProgress: 0, total: selectedFiles.length });
    setConvertedResults([]);

    try {
      const results = await convertBatch(
        selectedFiles,
        { potrace: potraceOpts },
        (fileIndex, fileProgress, totalFiles) =>
          setProgress({ fileIndex, fileProgress, total: totalFiles }),
      );
      setConvertedResults(results);
      // Auto-select first successful result for preview
      const firstSuccess = results.findIndex((r) => !r.error);
      setPreviewIndex(firstSuccess >= 0 ? firstSuccess : 0);
    } catch (err: any) {
      alert(`Conversion error: ${err?.message ?? String(err)}`);
    } finally {
      setIsConverting(false);
    }
  }

  // ── Download ─────────────────────────────────────────────────────────

  function downloadFile(file: SvgResult) {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    const successful = convertedResults.filter((r) => !r.error);
    if (!successful.length || isZipping) return;

    if (successful.length === 1) {
      downloadFile(successful[0]);
      return;
    }

    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of successful) {
        zip.file(file.name, file.buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "localkit-image-to-svg.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Zip error: ${err?.message ?? String(err)}`);
    } finally {
      setIsZipping(false);
    }
  }

  // ── Helpers for settings ─────────────────────────────────────────────

  function updatePotrace<K extends keyof PotraceOptions>(
    key: K,
    value: PotraceOptions[K],
  ) {
    setPotraceOpts((prev) => ({ ...prev, [key]: value }));
  }

  function applyPotracePreset(presetId: PotracePresetId) {
    setPotraceOpts({ ...POTRACE_PRESETS[presetId].options });
  }

  function resetSettings() {
    setPotraceOpts({ ...DEFAULT_IMAGE_TO_SVG_PREFERENCES.potrace });
  }

  // ── Render ───────────────────────────────────────────────────────────

  const progressPercent = progress.total
    ? Math.round(
        ((progress.fileIndex + progress.fileProgress) / progress.total) * 100,
      )
    : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      {/* ── Left column ──────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Drop zone */}
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
            isDragging
              ? "border-accent-purple bg-accent-purple/5"
              : "border-border-card hover:border-border-card-hover"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept={ACCEPTED_INPUTS}
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={handleFileInputChange}
          />

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-purple/20 bg-accent-purple/10">
            <svg
              className="h-7 w-7 text-accent-purple"
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
            Drop images here or{" "}
            <span className="text-accent-purple">browse</span>
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            PNG, JPG, GIF, BMP, WebP, TIFF
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Multiple files supported for batch conversion
          </p>
        </div>

        {/* SVG Preview */}
        {hasFiles && previewFile && (
          <div className="rounded-xl border border-border-card bg-bg-card overflow-hidden">
            {/* Preview toolbar */}
            <div className="flex items-center justify-between border-b border-border-card px-4 py-2">
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                {(["svg", "original", "side-by-side"] as ViewMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                        viewMode === mode
                          ? "bg-accent-purple/20 text-accent-purple"
                          : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {mode === "side-by-side"
                        ? "Side by Side"
                        : mode === "svg"
                          ? "SVG"
                          : "Original"}
                    </button>
                  ),
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="max-w-44 truncate text-[10px] font-medium text-text-secondary">
                    {previewFile.name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {isPreviewRendering
                      ? "Updating live preview..."
                      : `Live preview at ${POTRACE_PREVIEW_MAX_DIM}px max`}
                  </p>
                </div>
                {/* Background mode */}
                {(["checker", "dark", "light"] as BgMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBgMode(mode)}
                    className={`h-5 w-5 rounded border transition-colors ${
                      bgMode === mode
                        ? "border-accent-purple ring-1 ring-accent-purple"
                        : "border-border-card"
                    }`}
                    style={
                      mode === "checker"
                        ? {
                            backgroundImage:
                              "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)",
                            backgroundSize: "6px 6px",
                            backgroundColor: "#999",
                          }
                        : {
                            backgroundColor:
                              mode === "dark" ? "#0c0c1d" : "#ffffff",
                          }
                    }
                    title={mode}
                  />
                ))}
                {/* Zoom */}
                <select
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="rounded border border-border-card bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-secondary outline-none"
                >
                  {[50, 75, 100, 150, 200].map((z) => (
                    <option key={z} value={z}>
                      {z}%
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview area */}
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                ...BG_STYLES[bgMode],
                minHeight: "300px",
                maxHeight: "500px",
              }}
            >
              {previewResult?.error ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
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
                  <p className="text-xs text-accent-red font-medium">
                    Preview Failed
                  </p>
                  <p className="text-[10px] text-text-muted max-w-xs">
                    {previewResult.error}
                  </p>
                </div>
              ) : viewMode === "side-by-side" ? (
                <div
                  className="flex w-full h-full"
                  style={{ minHeight: "300px", maxHeight: "500px" }}
                >
                  <div className="flex-1 flex items-center justify-center border-r border-border-card/30 p-2 overflow-hidden">
                    {originalBlobUrl && (
                      <img
                        src={originalBlobUrl}
                        alt="Original"
                        className="max-h-full max-w-full object-contain"
                        style={{
                          transform: `scale(${zoom / 100})`,
                          transformOrigin: "center center",
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
                    {svgBlobUrl ? (
                      <img
                        src={svgBlobUrl}
                        alt="SVG Preview"
                        className="max-h-full max-w-full object-contain"
                        style={{
                          transform: `scale(${zoom / 100})`,
                          transformOrigin: "center center",
                        }}
                      />
                    ) : (
                      <PreviewLoadingState />
                    )}
                  </div>
                </div>
              ) : viewMode === "original" ? (
                originalBlobUrl && (
                  <img
                    src={originalBlobUrl}
                    alt="Original"
                    className="max-h-full max-w-full object-contain"
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "center center",
                    }}
                  />
                )
              ) : svgBlobUrl ? (
                <img
                  src={svgBlobUrl}
                  alt="SVG Preview"
                  className="max-h-full max-w-full object-contain p-2"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "center center",
                  }}
                />
              ) : (
                <PreviewLoadingState />
              )}
            </div>

            {/* File navigation for batch */}
            {selectedFiles.length > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-border-card px-4 py-2">
                <button
                  type="button"
                  onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  disabled={previewIndex === 0}
                  className="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-xs text-text-secondary">
                  {previewIndex + 1} / {selectedFiles.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex((i) =>
                      Math.min(selectedFiles.length - 1, i + 1),
                    )
                  }
                  disabled={previewIndex === selectedFiles.length - 1}
                  className="rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right column ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Selected files */}
        {hasFiles && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Selected Files{" "}
                <span className="text-text-muted">
                  ({selectedFiles.length})
                </span>
              </h3>
              <button
                type="button"
                onClick={clearFiles}
                className="text-xs text-text-muted transition-colors hover:text-accent-red"
              >
                Clear all
              </button>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    previewIndex === index
                      ? "border-accent-purple/30 bg-accent-purple/5"
                      : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-purple/10">
                      <svg
                        className="h-4 w-4 text-accent-purple"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-text-muted transition-colors hover:text-accent-red"
                    aria-label={`Remove ${file.name}`}
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {hasFiles && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Vectorization Settings
              </h3>
              <button
                type="button"
                onClick={resetSettings}
                className="text-[10px] text-text-muted transition-colors hover:text-accent-purple"
                title="Reset to default values"
              >
                Reset
              </button>
            </div>

            <div className="mb-4">
              <SelectField
                label="Preset"
                value={currentPotracePreset}
                onChange={(e) => {
                  if (e.target.value === "custom") return;
                  applyPotracePreset(e.target.value as PotracePresetId);
                }}
                tooltip="Apply a tuned starting point for common image types. Once you adjust individual controls, the preset switches to Custom."
              >
                {POTRACE_PRESET_IDS.map((presetId) => ({
                  value: presetId,
                  label: POTRACE_PRESETS[presetId].label,
                })).map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </SelectField>

              <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
                {currentPotracePreset === "custom"
                  ? "Custom Potrace tuning. Choose a preset to quickly reapply a starting profile."
                  : POTRACE_PRESETS[currentPotracePreset].description}
              </p>

              <p className="flex items-center gap-1 text-[10px] text-text-muted">
                <svg
                  className="h-3 w-3 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Potrace is GPL-v2.0 and works best when you want tighter,
                simpler SVG output.
              </p>
            </div>

            <div className="space-y-3">
              <>
                <SliderField
                  label="Noise Filter"
                  value={potraceOpts.turdsize}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => updatePotrace("turdsize", v)}
                  tooltip="Removes small speckles and noise smaller than this area (in pixels). Higher values give a cleaner result but may remove small details."
                />

                <SelectField
                  label="Turn Policy"
                  value={potraceOpts.turnpolicy}
                  onChange={(e) =>
                    updatePotrace("turnpolicy", Number(e.target.value))
                  }
                  tooltip="How to resolve ambiguities when tracing edges. Minority and Majority usually give the best results for most images."
                >
                  {TURN_POLICY_LABELS.map((label, i) => (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  ))}
                </SelectField>

                <SliderField
                  label="Corner Smoothness"
                  value={potraceOpts.alphamax}
                  min={0}
                  max={1.34}
                  step={0.01}
                  onChange={(v) => updatePotrace("alphamax", v)}
                  tooltip="Controls how smooth corners are. 0 produces only sharp corners, 1.34 creates the smoothest possible curves."
                />

                <CheckboxField
                  label="Optimize curves"
                  checked={potraceOpts.opticurve === 1}
                  onChange={(v) => updatePotrace("opticurve", v ? 1 : 0)}
                  tooltip="Joins adjacent curves to create a simpler, smaller SVG file. Usually produces better results when enabled."
                />

                <SliderField
                  label="Optimization Tolerance"
                  value={potraceOpts.opttolerance}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updatePotrace("opttolerance", v)}
                  tooltip="How much curves can deviate when being optimized. Higher values produce simpler output but less accurately match the original."
                />

                <CheckboxField
                  label="Extract colors"
                  checked={potraceOpts.extractcolors}
                  onChange={(v) => updatePotrace("extractcolors", v)}
                  tooltip="Detects and preserves colors from the original image. When off, output is black and white only."
                />

                <SliderField
                  label="Color Levels"
                  value={potraceOpts.posterizelevel}
                  min={1}
                  max={255}
                  step={1}
                  onChange={(v) => updatePotrace("posterizelevel", v)}
                  tooltip="Number of color levels to use. Higher values capture more color detail but create a more complex (larger) SVG."
                />

                <SelectField
                  label="Color Algorithm"
                  value={potraceOpts.posterizationalgorithm}
                  onChange={(e) =>
                    updatePotrace(
                      "posterizationalgorithm",
                      Number(e.target.value),
                    )
                  }
                  tooltip="How colors are reduced. Simple divides colors evenly, Interpolation blends between levels for smoother gradients."
                >
                  <option value={0}>Simple</option>
                  <option value={1}>Interpolation</option>
                </SelectField>
              </>
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-text-muted">
              Live preview updates the selected file after a short pause and
              uses a reduced {POTRACE_PREVIEW_MAX_DIM}px source for speed. Use
              the full convert action to refresh downloadable SVGs for every
              file.
            </p>

            {/* Convert button */}
            <button
              type="button"
              onClick={convertFiles}
              disabled={isConverting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-purple px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-purple/80 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
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
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              {isConverting ? "Converting..." : "Convert with Potrace"}
            </button>
          </div>
        )}

        {/* Progress */}
        {isConverting && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                Converting...
              </span>
              <span className="font-mono text-xs text-text-muted">
                {Math.min(progress.fileIndex + 1, progress.total)}/
                {progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent-purple transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {hasResults &&
          (() => {
            const successCount = convertedResults.filter(
              (r) => !r.error,
            ).length;
            const failCount = convertedResults.length - successCount;

            return (
              <div className="rounded-xl border border-border-card bg-bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-accent-green">
                      Conversion Complete
                    </h3>
                    {failCount > 0 && (
                      <p className="text-[10px] text-accent-red mt-0.5">
                        {failCount} file{failCount > 1 ? "s" : ""} failed
                      </p>
                    )}
                  </div>
                  {successCount > 0 && (
                    <button
                      type="button"
                      onClick={downloadAll}
                      disabled={isZipping}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-all hover:bg-accent-green/20 disabled:pointer-events-none disabled:opacity-50"
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
                  {convertedResults.map((result, index) => {
                    const originalSize = selectedFiles[index]?.size ?? 0;
                    const outputSize = result.buffer.byteLength;
                    const failed = !!result.error;

                    return (
                      <div
                        key={`${result.name}-${outputSize}-${index}`}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          failed
                            ? previewIndex === index
                              ? "border-accent-red/30 bg-accent-red/5"
                              : "border-accent-red/20 bg-accent-red/5 hover:bg-accent-red/10"
                            : previewIndex === index
                              ? "border-accent-purple/30 bg-accent-purple/5"
                              : "border-accent-green/20 bg-accent-green/5 hover:bg-accent-green/10"
                        }`}
                        onClick={() => setPreviewIndex(index)}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                            failed ? "bg-accent-red/10" : "bg-accent-green/10"
                          }`}
                        >
                          {failed ? (
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
                              className="h-4 w-4 text-accent-green"
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
                          {failed ? (
                            <p
                              className="text-[10px] text-accent-red truncate"
                              title={result.error}
                            >
                              Failed
                            </p>
                          ) : (
                            <p className="text-[10px] text-text-muted">
                              {formatSize(originalSize)}
                              <span className="mx-1 text-text-muted/60">
                                &rarr;
                              </span>
                              {formatSize(outputSize)}
                            </p>
                          )}
                        </div>
                        {!failed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(result);
                            }}
                            className="shrink-0 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-medium text-accent-green transition-colors hover:bg-accent-green/20"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}

// ── Reusable sub-components ──────────────────────────────────────────────

function PreviewLoadingState() {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple/20 border-t-accent-purple" />
      <p className="text-xs font-medium text-text-secondary">
        Rendering preview
      </p>
      <p className="max-w-xs text-[10px] text-text-muted">
        Potrace is retracing the selected image with the latest settings.
      </p>
    </div>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex">
      <svg
        className="h-3 w-3 text-text-muted/60 transition-colors group-hover:text-text-secondary cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 rounded-lg border border-border-card bg-bg-card px-2.5 py-1.5 text-[10px] leading-relaxed text-text-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
  tooltip?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
        <span className="flex items-center">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </span>
        <span className="font-mono text-text-muted">
          {step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : value}
          {unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${styles.sliderRange} w-full`}
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  tooltip?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-accent-purple bg-accent-purple/20"
            : "border-border-card bg-bg-secondary"
        }`}
      >
        <svg
          className={`h-3 w-3 text-accent-purple ${checked ? "block" : "hidden"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>
      <span className="flex items-center text-xs text-text-secondary">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  tooltip,
}: {
  label: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center text-xs font-medium text-text-secondary">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
      >
        {children}
      </select>
    </div>
  );
}
