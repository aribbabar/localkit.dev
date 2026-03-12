import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { ImageMetadata, MetadataCategory, MetadataField, StrippedImage } from "../../lib/image-metadata";

let metadataLib: typeof import("../../lib/image-metadata") | null = null;
async function getMetadataLib() {
  if (!metadataLib) metadataLib = await import("../../lib/image-metadata");
  return metadataLib;
}

const ACCEPTED_INPUTS = "image/*,.heic,.heif,.tiff,.tif,.bmp,.webp,.avif";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedImage(file: File) {
  return file.type.startsWith("image/") || /\.(heic|heif|tiff?|bmp|webp|avif)$/i.test(file.name);
}

// Category icon components
function CategoryIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "camera":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
      );
    case "image":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      );
    case "gps":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      );
    case "dates":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      );
    case "author":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      );
    case "software":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
  }
}

interface FileEntry {
  file: File;
  metadata: ImageMetadata | null;
  loading: boolean;
  error: string | null;
}

export default function ImageMetadataTool() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isStripping, setIsStripping] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [strippedFiles, setStrippedFiles] = useState<StrippedImage[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;
  const selected = hasFiles ? files[selectedIndex] : null;
  const metadata = selected?.metadata;

  // Auto-expand all categories when metadata loads
  useEffect(() => {
    if (metadata) {
      setExpandedCategories(new Set(metadata.categories.map((c) => c.label)));
    }
  }, [metadata]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingKey && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingKey]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.metadata) {
          getMetadataLib().then((lib) => lib.cleanupMetadata(f.metadata!));
        }
      });
    };
  }, []);

  const parseFile = useCallback(async (file: File, index: number) => {
    try {
      const lib = await getMetadataLib();
      const meta = await lib.parseMetadata(file);
      setFiles((prev) =>
        prev.map((entry, i) => (i === index ? { ...entry, metadata: meta, loading: false } : entry)),
      );
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((entry, i) =>
          i === index ? { ...entry, loading: false, error: err?.message ?? "Failed to parse metadata" } : entry,
        ),
      );
    }
  }, []);

  function addFiles(newFiles: File[]) {
    const accepted = newFiles.filter(isAcceptedImage);
    if (!accepted.length) return;

    const startIndex = files.length;
    const entries: FileEntry[] = accepted.map((file) => ({
      file,
      metadata: null,
      loading: true,
      error: null,
    }));

    setFiles((prev) => [...prev, ...entries]);
    setStrippedFiles([]);
    setEditedFields({});
    setEditingKey(null);

    // Select first new file if nothing selected
    if (!hasFiles) setSelectedIndex(0);

    // Parse metadata for all new files
    accepted.forEach((file, i) => parseFile(file, startIndex + i));
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
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  }

  function removeFile(index: number) {
    const entry = files[index];
    if (entry.metadata) {
      getMetadataLib().then((lib) => lib.cleanupMetadata(entry.metadata!));
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex((prev) => {
      if (prev >= index && prev > 0) return prev - 1;
      return prev;
    });
    setStrippedFiles([]);
    setEditedFields({});
  }

  function clearFiles() {
    files.forEach((f) => {
      if (f.metadata) {
        getMetadataLib().then((lib) => lib.cleanupMetadata(f.metadata!));
      }
    });
    setFiles([]);
    setSelectedIndex(0);
    setStrippedFiles([]);
    setProgress({ done: 0, total: 0 });
    setEditedFields({});
    setEditingKey(null);
  }

  function toggleCategory(label: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function startEditing(field: MetadataField) {
    setEditingKey(field.key);
    if (!(field.key in editedFields)) {
      setEditedFields((prev) => ({ ...prev, [field.key]: field.value }));
    }
  }

  function saveEdit(key: string) {
    setEditingKey(null);
    // The edited value is already in editedFields
  }

  function cancelEdit() {
    if (editingKey) {
      setEditedFields((prev) => {
        const next = { ...prev };
        delete next[editingKey];
        return next;
      });
      setEditingKey(null);
    }
  }

  function getFieldValue(field: MetadataField): string {
    return field.key in editedFields ? editedFields[field.key] : field.value;
  }

  function isFieldEdited(field: MetadataField): boolean {
    return field.key in editedFields && editedFields[field.key] !== field.value;
  }

  async function stripAllMetadata() {
    if (!files.length || isStripping) return;

    setIsStripping(true);
    setStrippedFiles([]);
    setProgress({ done: 0, total: files.length });

    try {
      const lib = await getMetadataLib();
      const results = await lib.stripMetadataBatch(
        files.map((f) => f.file),
        (done, total) => setProgress({ done, total }),
      );
      setStrippedFiles(results);
    } catch (err: any) {
      alert(`Error stripping metadata: ${err?.message ?? String(err)}`);
    } finally {
      setIsStripping(false);
    }
  }

  async function stripSingleFile(index: number) {
    const entry = files[index];
    if (!entry) return;

    try {
      const lib = await getMetadataLib();
      const result = await lib.stripMetadata(entry.file);
      downloadBlob(result.blob, result.name);
    } catch (err: any) {
      alert(`Error: ${err?.message ?? String(err)}`);
    }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadStrippedFile(file: StrippedImage) {
    downloadBlob(file.blob, file.name);
  }

  async function downloadAllStripped() {
    if (!strippedFiles.length || isZipping) return;

    if (strippedFiles.length === 1) {
      downloadStrippedFile(strippedFiles[0]);
      return;
    }

    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const file of strippedFiles) {
        zip.file(file.name, file.buffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "localkit-clean-images.zip");
    } catch (err: any) {
      alert(`Zip error: ${err?.message ?? String(err)}`);
    } finally {
      setIsZipping(false);
    }
  }

  function exportMetadataJson() {
    if (!metadata) return;
    const data = JSON.stringify(metadata.raw, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    downloadBlob(blob, `${metadata.fileName.replace(/\.[^.]+$/, "")}_metadata.json`);
  }

  // Filter categories/fields based on search
  function getFilteredCategories(): MetadataCategory[] {
    if (!metadata) return [];
    if (!searchQuery.trim()) return metadata.categories;

    const q = searchQuery.toLowerCase();
    return metadata.categories
      .map((cat) => ({
        ...cat,
        fields: cat.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            getFieldValue(f).toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.fields.length > 0);
  }

  const totalFields = metadata?.categories.reduce((sum, c) => sum + c.fields.length, 0) ?? 0;
  const hasGps = metadata?.categories.some((c) => c.icon === "gps") ?? false;
  const filteredCategories = getFilteredCategories();

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
          isDragging ? "border-accent-purple bg-accent-purple/5" : "border-border-card hover:border-border-card-hover"
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
          <svg className="h-7 w-7 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="font-display text-sm font-semibold text-text-primary">
          Drop images here or <span className="text-accent-purple">browse</span>
        </p>
        <p className="mt-1.5 text-xs text-text-muted">JPEG, PNG, TIFF, HEIC, WebP, AVIF and more</p>
        <p className="mt-1 text-xs text-text-muted">Multiple files supported for batch processing</p>
      </div>

      {hasFiles && (
        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          {/* Left sidebar: file list */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border-card bg-bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text-primary">
                  Images <span className="text-text-muted">({files.length})</span>
                </h3>
                <button type="button" onClick={clearFiles} className="text-xs text-text-muted transition-colors hover:text-accent-red">
                  Clear all
                </button>
              </div>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {files.map((entry, index) => (
                  <button
                    key={`${entry.file.name}-${entry.file.size}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(index);
                      setEditedFields({});
                      setEditingKey(null);
                      setSearchQuery("");
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                      index === selectedIndex
                        ? "border-accent-purple/30 bg-accent-purple/10"
                        : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-primary">
                      {entry.metadata?.previewUrl ? (
                        <img src={entry.metadata.previewUrl} alt={`Thumbnail of ${entry.file.name}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text-primary">{entry.file.name}</p>
                      <p className="text-[10px] text-text-muted">
                        {formatSize(entry.file.size)}
                        {entry.loading && " — parsing..."}
                        {entry.error && " — error"}
                        {entry.metadata && ` — ${entry.metadata.categories.reduce((s, c) => s + c.fields.length, 0)} fields`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="shrink-0 text-text-muted transition-colors hover:text-accent-red"
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk actions */}
            <div className="rounded-xl border border-border-card bg-bg-card p-4">
              <h3 className="font-display mb-3 text-sm font-semibold text-text-primary">Bulk Actions</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={stripAllMetadata}
                  disabled={isStripping}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-purple px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-accent-purple/80 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                  </svg>
                  {isStripping ? "Stripping..." : "Strip All Metadata"}
                </button>
              </div>
            </div>

            {/* Progress */}
            {isStripping && (
              <div className="rounded-xl border border-border-card bg-bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Stripping metadata...</span>
                  <span className="font-mono text-xs text-text-muted">{progress.done}/{progress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent-purple transition-all duration-300"
                    style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stripped results */}
            {strippedFiles.length > 0 && (
              <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-accent-green">Clean Images Ready</h3>
                  <button
                    type="button"
                    onClick={downloadAllStripped}
                    disabled={isZipping}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-1.5 text-xs font-medium text-accent-green transition-all hover:bg-accent-green/20 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    {isZipping ? "Zipping..." : strippedFiles.length === 1 ? "Download" : "Download ZIP"}
                  </button>
                </div>
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {strippedFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-accent-green/10 bg-bg-card px-3 py-1.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-xs text-text-primary">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => downloadStrippedFile(file)}
                        className="shrink-0 text-[10px] font-medium text-accent-green transition-colors hover:text-accent-green/80"
                      >
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel: metadata viewer */}
          <div className="space-y-4">
            {selected?.loading && (
              <div className="flex items-center justify-center rounded-xl border border-border-card bg-bg-card p-12">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
                  <p className="text-sm text-text-muted">Parsing metadata...</p>
                </div>
              </div>
            )}

            {selected?.error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 p-6 text-center">
                <svg className="mx-auto mb-2 h-8 w-8 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-accent-red">{selected.error}</p>
              </div>
            )}

            {metadata && (
              <>
                {/* File summary header */}
                <div className="rounded-xl border border-border-card bg-bg-card p-5">
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border-card bg-bg-primary">
                      <img src={metadata.previewUrl} alt={`Preview of ${metadata.fileName}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-sm font-bold text-text-primary">{metadata.fileName}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-md border border-border-card bg-bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                          {formatSize(metadata.fileSize)}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border-card bg-bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                          {metadata.fileType || "unknown"}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-accent-purple/20 bg-accent-purple/10 px-2 py-0.5 text-[10px] font-medium text-accent-purple">
                          {totalFields} metadata fields
                        </span>
                        {hasGps && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-accent-red/20 bg-accent-red/10 px-2 py-0.5 text-[10px] font-medium text-accent-red">
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            Contains GPS data
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => stripSingleFile(selectedIndex)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/30 bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple transition-all hover:bg-accent-purple/20"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                          </svg>
                          Strip & Download
                        </button>
                        <button
                          type="button"
                          onClick={exportMetadataJson}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border-card bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-border-card-hover hover:text-text-primary"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Export JSON
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search bar */}
                {totalFields > 5 && (
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search metadata fields..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border-card bg-bg-card py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-card-hover focus:ring-1 focus:ring-border-card-hover"
                    />
                  </div>
                )}

                {/* No metadata message */}
                {totalFields === 0 && (
                  <div className="rounded-xl border border-border-card bg-bg-card p-8 text-center">
                    <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm text-text-muted">No metadata found in this image</p>
                    <p className="mt-1 text-xs text-text-muted">The image may have already been stripped of metadata</p>
                  </div>
                )}

                {/* Metadata categories */}
                {filteredCategories.map((category) => (
                  <div key={category.label} className="overflow-hidden rounded-xl border border-border-card bg-bg-card">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.label)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-bg-card-hover"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-accent-purple/20 bg-accent-purple/10 text-accent-purple">
                        <CategoryIcon icon={category.icon} />
                      </div>
                      <span className="font-display flex-1 text-sm font-semibold text-text-primary">{category.label}</span>
                      <span className="mr-2 text-xs text-text-muted">{category.fields.length}</span>
                      <svg
                        className={`h-4 w-4 text-text-muted transition-transform ${expandedCategories.has(category.label) ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {expandedCategories.has(category.label) && (
                      <div className="border-t border-border-card">
                        {category.fields.map((field) => (
                          <div
                            key={field.key}
                            className="group flex items-start gap-3 border-b border-border-card/50 px-5 py-2.5 last:border-0"
                          >
                            <span className="w-40 shrink-0 pt-0.5 text-xs font-medium text-text-secondary">{field.label}</span>
                            <div className="min-w-0 flex-1">
                              {editingKey === field.key ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editedFields[field.key] ?? field.value}
                                    onChange={(e) => setEditedFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEdit(field.key);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    className="w-full rounded border border-accent-purple/30 bg-bg-secondary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple/30"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(field.key)}
                                    className="shrink-0 rounded bg-accent-purple/20 p-1 text-accent-purple transition-colors hover:bg-accent-purple/30"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="shrink-0 rounded bg-bg-secondary p-1 text-text-muted transition-colors hover:text-accent-red"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2">
                                  <p className={`break-all text-xs ${isFieldEdited(field) ? "text-accent-purple" : "text-text-primary"}`}>
                                    {getFieldValue(field)}
                                    {isFieldEdited(field) && (
                                      <span className="ml-1.5 text-[10px] text-accent-purple">(edited)</span>
                                    )}
                                  </p>
                                  {field.editable && (
                                    <button
                                      type="button"
                                      onClick={() => startEditing(field)}
                                      className="shrink-0 rounded p-0.5 text-text-muted opacity-0 transition-all hover:text-accent-purple group-hover:opacity-100"
                                      aria-label={`Edit ${field.label}`}
                                    >
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {searchQuery && filteredCategories.length === 0 && (
                  <div className="rounded-xl border border-border-card bg-bg-card p-6 text-center">
                    <p className="text-sm text-text-muted">No fields match "{searchQuery}"</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
