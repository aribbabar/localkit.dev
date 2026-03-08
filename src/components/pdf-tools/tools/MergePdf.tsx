import { useState } from "react";
import type { ConvertedFile } from "../../../lib/mupdf";
import {
  PdfDropZone,
  FileList,
  ProgressBar,
  ResultsList,
  ActionButton,
  downloadBlob,
} from "../shared";

let mupdfLib: typeof import("../../../lib/mupdf") | null = null;
async function getMupdf() {
  if (!mupdfLib) mupdfLib = await import("../../../lib/mupdf");
  return mupdfLib;
}

export default function MergePdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ConvertedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  function addFiles(newFiles: File[]) {
    setFiles((prev) => [...prev, ...newFiles]);
    setResult(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function reorderFiles(from: number, to: number) {
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function clearAll() {
    setFiles([]);
    setResult(null);
  }

  async function merge() {
    if (files.length < 2 || isProcessing) return;
    setIsProcessing(true);
    setResult(null);
    setProgress({ done: 0, total: files.length });

    try {
      const { mergePdfs } = await getMupdf();
      const merged = await mergePdfs(files, (done, total) =>
        setProgress({ done, total })
      );
      setResult(merged);
    } catch (err: any) {
      alert(`Merge error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PdfDropZone
        onFiles={addFiles}
        label="Drop PDF files here"
        hint="or click to browse"
      >
        <p className="mt-1.5 text-xs text-text-muted">
          Upload 2 or more PDFs to merge them into one
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Drag files in the list below to reorder
        </p>
      </PdfDropZone>

      {files.length > 0 && (
        <FileList
          files={files}
          onRemove={removeFile}
          onClear={clearAll}
          onReorder={reorderFiles}
        />
      )}

      {files.length >= 2 && !result && (
        <ActionButton
          onClick={merge}
          loading={isProcessing}
          label={`Merge ${files.length} PDFs`}
          loadingLabel="Merging..."
          disabled={files.length < 2}
        />
      )}

      {isProcessing && (
        <ProgressBar
          done={progress.done}
          total={progress.total}
          label="Merging files..."
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
