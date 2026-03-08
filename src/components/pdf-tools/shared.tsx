import { useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

// ── Utility ──

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Drop Zone ──

export function PdfDropZone({
  onFiles,
  multiple = true,
  accept = ".pdf",
  label = "Drop PDF files here",
  hint = "or click to browse",
  children,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  children?: ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);

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
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
      );
      if (files.length) onFiles(files);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      onFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  return (
    <div
      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
        isDragging
          ? "border-accent-red bg-accent-red/5"
          : "border-border-card hover:border-border-card-hover"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
        onChange={handleChange}
      />

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-red/20 bg-accent-red/10">
        <svg
          className="h-7 w-7 text-accent-red"
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
        {label} <span className="text-accent-red">{hint}</span>
      </p>
      {children}
    </div>
  );
}

// ── File list ──

export function FileList({
  files,
  onRemove,
  onClear,
  onReorder,
}: {
  files: File[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onReorder?: (from: number, to: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-border-card bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-text-primary">
          Selected Files{" "}
          <span className="text-text-muted">({files.length})</span>
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-text-muted transition-colors hover:text-accent-red"
        >
          Clear all
        </button>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className={`flex items-center gap-3 rounded-lg border border-border-card bg-bg-secondary px-3 py-2 ${
              onReorder ? "cursor-grab active:cursor-grabbing" : ""
            } ${dragIdx === index ? "opacity-50" : ""}`}
            draggable={!!onReorder}
            onDragStart={() => setDragIdx(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (onReorder && dragIdx !== null && dragIdx !== index) {
                onReorder(dragIdx, index);
                setDragIdx(index);
              }
            }}
            onDragEnd={() => setDragIdx(null)}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-red/10">
              <svg
                className="h-4 w-4 text-accent-red"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
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
            <button
              type="button"
              onClick={() => onRemove(index)}
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
  );
}

// ── Progress bar ──

export function ProgressBar({
  done,
  total,
  label = "Processing...",
}: {
  done: number;
  total: number;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          {label}
        </span>
        <span className="font-mono text-xs text-text-muted">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
        <div
          className="h-full rounded-full bg-accent-red transition-all duration-300"
          style={{
            width: `${total ? Math.round((done / total) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
  );
}

// ── Results list ──

export function ResultsList({
  files,
  onDownload,
  onDownloadAll,
  isZipping = false,
}: {
  files: { name: string; blob: Blob; buffer: ArrayBuffer }[];
  onDownload: (index: number) => void;
  onDownloadAll: () => void;
  isZipping?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-accent-green">
          Complete
        </h3>
        <button
          type="button"
          onClick={onDownloadAll}
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
            : files.length === 1
              ? "Download"
              : "Download ZIP"}
        </button>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">
                {file.name}
              </p>
              <p className="text-[10px] text-text-muted">
                {formatSize(file.buffer.byteLength)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDownload(index)}
              className="shrink-0 rounded-md border border-accent-green/30 bg-accent-green/10 px-2 py-1 text-[10px] font-medium text-accent-green transition-colors hover:bg-accent-green/20"
            >
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Action button ──

export function ActionButton({
  onClick,
  disabled,
  loading,
  label,
  loadingLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-red px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-red/80 hover:shadow-[0_0_24px_rgba(239,68,68,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      {loading ? (loadingLabel ?? "Processing...") : label}
    </button>
  );
}
