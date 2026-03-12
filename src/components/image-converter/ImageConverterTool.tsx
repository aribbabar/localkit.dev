import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import type { ConvertedFile, ImageInfo } from "../../lib/imagemagick";
import styles from "./ImageConverterTool.module.css";

let imagemagick: typeof import("../../lib/imagemagick") | null = null;

async function getImageMagick() {
  if (!imagemagick) {
    imagemagick = await import("../../lib/imagemagick");
  }
  return imagemagick;
}

const LOSSY_FORMATS = new Set(["jpg", "psd", "heic", "heif"]);
const FALLBACK_OUTPUT_FORMATS = [
  { ext: "png", label: "PNG" },
  { ext: "jpg", label: "JPEG" },
  { ext: "gif", label: "GIF" },
  { ext: "bmp", label: "BMP" },
  { ext: "tiff", label: "TIFF" },
  { ext: "ico", label: "ICO" },
  { ext: "tga", label: "TGA" },
  { ext: "psd", label: "PSD" },
  { ext: "ppm", label: "PPM" },
  { ext: "pgm", label: "PGM" },
  { ext: "hdr", label: "HDR" },
  { ext: "pcx", label: "PCX" },
];
const INPUT_EXTENSION_PATTERN = /\.(heic|heif|psd|tga|bmp|tiff?|ico|pcx|pgm|ppm|hdr|xcf|gif)$/i;
const ACCEPTED_INPUTS = "image/*,.heic,.heif,.psd,.tga,.bmp,.tiff,.ico,.pcx,.pgm,.ppm,.hdr,.xcf";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedImage(file: File) {
  return file.type.startsWith("image/") || INPUT_EXTENSION_PATTERN.test(file.name);
}

export default function ImageConverterTool() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState("png");
  const [outputFormats, setOutputFormats] = useState(FALLBACK_OUTPUT_FORMATS);
  const [quality, setQuality] = useState(90);
  const [resize, setResize] = useState("");
  const [stripMetadata, setStripMetadata] = useState(false);
  const [imageInfos, setImageInfos] = useState<(ImageInfo | null)[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const hasFiles = selectedFiles.length > 0;
  const showQuality = useMemo(() => LOSSY_FORMATS.has(outputFormat), [outputFormat]);

  // Compute per-file and total estimated sizes
  const fileEstimates = useMemo(() => {
    if (!imageInfos.length || !imagemagick) return null;
    const opts = {
      quality: showQuality ? quality : undefined,
      resize: resize.trim() || undefined,
    };
    const estimates: (number | null)[] = imageInfos.map((info) =>
      info ? imagemagick!.estimateOutputSize(info, outputFormat, opts) : null
    );
    const validEstimates = estimates.filter((e): e is number => e !== null);
    if (!validEstimates.length) return null;
    return {
      perFile: estimates,
      total: validEstimates.reduce((sum, e) => sum + e, 0),
      count: validEstimates.length,
    };
  }, [imageInfos, outputFormat, quality, showQuality, resize]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { getAvailableOutputFormats } = await getImageMagick();
        const availableFormats = await getAvailableOutputFormats();
        if (!availableFormats.length || cancelled) {
          return;
        }

        const nextFormats = availableFormats.map((format) => ({ ext: format.ext, label: format.label }));
        setOutputFormats(nextFormats);
        setOutputFormat((prev) => {
          if (nextFormats.some((format) => format.ext === prev)) {
            return prev;
          }
          return nextFormats[0].ext;
        });
      } catch {
        // Keep fallback options when format probing fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function addFiles(files: File[]) {
    const nextFiles = files.filter(isAcceptedImage);
    if (!nextFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...nextFiles]);
    setConvertedFiles([]);

    // Fetch image info for size estimation (non-blocking)
    void (async () => {
      const { getImageInfo } = await getImageMagick();
      const infos = await Promise.all(
        nextFiles.map((f) => getImageInfo(f).catch(() => null))
      );
      setImageInfos((prev) => [...prev, ...infos]);
    })();
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
    setImageInfos((prev) => prev.filter((_, i) => i !== index));
  }

  function clearFiles() {
    setSelectedFiles([]);
    setImageInfos([]);
    setConvertedFiles([]);
    setProgress({ done: 0, total: 0 });
  }

  async function convertFiles() {
    if (!selectedFiles.length || isConverting) return;

    setIsConverting(true);
    setProgress({ done: 0, total: selectedFiles.length });
    setConvertedFiles([]);

    try {
      const { convertBatch } = await getImageMagick();
      const result = await convertBatch(
        selectedFiles,
        outputFormat,
        {
          quality: showQuality ? quality : undefined,
          resize: resize.trim() || undefined,
          strip: stripMetadata,
        },
        (done, total) => setProgress({ done, total })
      );
      setConvertedFiles(result);
    } catch (err: any) {
      alert(`Conversion error: ${err?.message ?? String(err)}`);
    } finally {
      setIsConverting(false);
    }
  }

  function downloadFile(file: ConvertedFile) {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAll() {
    if (!convertedFiles.length || isZipping) return;

    if (convertedFiles.length === 1) {
      downloadFile(convertedFiles[0]);
      return;
    }

    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of convertedFiles) {
        zip.file(file.name, file.buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "localkit-converted-images.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Zip error: ${err?.message ?? String(err)}`);
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
              Drop images here or <span className="text-accent-purple">browse</span>
            </p>
            <p className="mt-1.5 text-xs text-text-muted">PNG, JPG, GIF, BMP, TIFF, HEIC, PSD, ICO, TGA and more</p>
            <p className="mt-1 text-xs text-text-muted">Multiple files supported for batch conversion</p>
          </div>
        </div>

        <div className="space-y-4">
          {hasFiles && (
            <div className="rounded-xl border border-border-card bg-bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text-primary">
                  Selected Files <span className="text-text-muted">({selectedFiles.length})</span>
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
                    className="flex items-center gap-3 rounded-lg border border-border-card bg-bg-secondary px-3 py-2"
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
                      <p className="truncate text-xs font-medium text-text-primary">{file.name}</p>
                      <p className="text-[10px] text-text-muted">
                        {formatSize(file.size)}
                        {fileEstimates?.perFile[index] != null && (
                          <span className="text-text-muted/60">
                            {" "}&rarr; ~{formatSize(fileEstimates.perFile[index])}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="shrink-0 text-text-muted transition-colors hover:text-accent-red"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasFiles && (
            <div className="rounded-xl border border-border-card bg-bg-card p-5">
              <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">Conversion Settings</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="output-format" className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Output Format
                  </label>
                  <select
                    id="output-format"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                  >
                    {outputFormats.map((format) => (
                      <option key={format.ext} value={format.ext}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>

                {showQuality && (
                  <div>
                    <label
                      htmlFor="quality-slider"
                      className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary"
                    >
                      <span>Quality</span>
                      <span className="font-mono text-text-muted">{quality}%</span>
                    </label>
                    <input
                      type="range"
                      id="quality-slider"
                      min="1"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className={`${styles.qualityRange} w-full`}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="resize-input" className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Resize <span className="text-text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="resize-input"
                    placeholder="e.g. 800x600 or 50%"
                    value={resize}
                    onChange={(e) => setResize(e.target.value)}
                    className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={stripMetadata}
                    onChange={(e) => setStripMetadata(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      stripMetadata
                        ? "border-accent-purple bg-accent-purple/20"
                        : "border-border-card bg-bg-secondary"
                    }`}
                  >
                    <svg
                      className={`h-3 w-3 text-accent-purple ${stripMetadata ? "block" : "hidden"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <span className="text-xs text-text-secondary">Strip metadata (EXIF, etc.)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={convertFiles}
                disabled={isConverting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-purple px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-purple/80 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
                  />
                </svg>
                {isConverting ? "Converting..." : "Convert"}
              </button>

              {fileEstimates && (
                <div className="mt-3 rounded-lg border border-border-card bg-bg-secondary px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-text-muted">Estimated output</span>
                    <span className="font-mono text-xs text-text-secondary">~{formatSize(fileEstimates.total)}</span>
                  </div>
                  {fileEstimates.count < selectedFiles.length && (
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      ({fileEstimates.count}/{selectedFiles.length} files estimated)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isConverting && (
            <div className="rounded-xl border border-border-card bg-bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Converting...</span>
                <span className="font-mono text-xs text-text-muted">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className="h-full rounded-full bg-accent-purple transition-all duration-300"
                  style={{
                    width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {convertedFiles.length > 0 && (
            <div className="rounded-xl border border-border-card bg-bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-accent-green">Conversion Complete</h3>
                <button
                  type="button"
                  onClick={downloadAll}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-all hover:bg-accent-green/20 disabled:pointer-events-none disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {isZipping ? "Zipping..." : "Download ZIP"}
                </button>
              </div>

              <div className="space-y-2">
                {convertedFiles.map((file, index) => {
                  const originalSize = selectedFiles[index]?.size ?? 0;
                  const outputSize = file.buffer.byteLength;
                  const delta = originalSize > 0 ? ((outputSize - originalSize) / originalSize) * 100 : 0;
                  const shrank = delta < -1;
                  const grew = delta > 1;

                  return (
                    <div
                      key={`${file.name}-${outputSize}-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-accent-green/5 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-green/10">
                        <svg
                          className="h-4 w-4 text-accent-green"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{file.name}</p>
                        <p className="text-[10px] text-text-muted">
                          {formatSize(originalSize)}
                          <span className="mx-1 text-text-muted/60">&rarr;</span>
                          {formatSize(outputSize)}
                          {(shrank || grew) && (
                            <span className={`ml-1 ${shrank ? "text-accent-green" : "text-accent-orange"}`}>
                              ({delta > 0 ? "+" : ""}{Math.round(delta)}%)
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadFile(convertedFiles[index])}
                        className="shrink-0 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-medium text-accent-green transition-colors hover:bg-accent-green/20"
                      >
                        Save
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
