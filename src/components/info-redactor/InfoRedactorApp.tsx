import { useState, useCallback } from "react";
import type {
  EntityType,
  RedactionEngine,
  RedactionStyle,
  DetectedEntity,
  ConvertedFile,
} from "../../lib/redactor";

type Step = "upload" | "configure" | "preview" | "done";

const ENTITY_OPTIONS: { type: EntityType; label: string; description: string }[] = [
  { type: "name", label: "Names", description: "People's names" },
  { type: "email", label: "Emails", description: "Email addresses" },
  { type: "phone", label: "Phone Numbers", description: "Phone numbers" },
  { type: "ssn", label: "SSN", description: "Social Security Numbers" },
  { type: "address", label: "Addresses", description: "Street addresses" },
  { type: "url", label: "URLs", description: "Web links" },
  { type: "organization", label: "Organizations", description: "Company & org names" },
  { type: "location", label: "Locations", description: "Cities, countries, places" },
];

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InfoRedactorApp() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [extractedText, setExtractedText] = useState("");
  const [redactedText, setRedactedText] = useState("");
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [result, setResult] = useState<ConvertedFile | null>(null);

  // Options
  const [selectedTypes, setSelectedTypes] = useState<EntityType[]>([
    "name",
    "email",
    "phone",
    "ssn",
  ]);
  const [engine, setEngine] = useState<RedactionEngine>("compromise");
  const [style, setStyle] = useState<RedactionStyle>("placeholder");

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const isPdf = file?.name.toLowerCase().endsWith(".pdf");

  const handleFiles = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
      alert("Please upload a PDF, TXT, or Markdown file.");
      return;
    }

    setFile(f);
    setResult(null);
    setEntities([]);
    setRedactedText("");
    // PDFs always use black box redaction
    if (ext === "pdf") setStyle("blackbox");
    setStep("configure");

    // Extract text for preview
    try {
      const { extractTextFromFile } = await import("../../lib/redactor");
      const text = await extractTextFromFile(f);
      setExtractedText(text);
    } catch (err: any) {
      alert(`Failed to read file: ${err?.message ?? String(err)}`);
      setStep("upload");
    }
  }, []);

  async function runDetection() {
    if (!extractedText || selectedTypes.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus(
      engine === "transformers"
        ? "Loading ML model (first use may take a moment)..."
        : "Analyzing text..."
    );

    try {
      const { detectEntities, applyRedactions: applyText } = await import(
        "../../lib/redactor"
      );
      const detected = await detectEntities(extractedText, {
        engine,
        entityTypes: selectedTypes,
        style,
      });

      setEntities(detected);
      setProcessingStatus(`Found ${detected.length} entities`);

      const redacted = applyText(extractedText, detected, style);
      setRedactedText(redacted);

      setStep("preview");
    } catch (err: any) {
      alert(`Detection error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  }

  async function handleRedact() {
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus("Applying redactions...");

    try {
      const {
        redactPdf,
        createRedactedTextFile,
        applyRedactions: applyText,
      } = await import("../../lib/redactor");

      let output: ConvertedFile;

      if (isPdf) {
        output = await redactPdf(file, entities, style, (done, total) => {
          setProcessingStatus(`Redacting page ${done}/${total}...`);
        });
      } else {
        const redacted = applyText(extractedText, entities, style);
        output = createRedactedTextFile(file.name, redacted);
      }

      setResult(output);
      setStep("done");
    } catch (err: any) {
      alert(`Redaction error: ${err?.message ?? String(err)}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  }

  function reset() {
    setFile(null);
    setStep("upload");
    setExtractedText("");
    setRedactedText("");
    setEntities([]);
    setResult(null);
  }

  function toggleEntityType(type: EntityType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Step: Upload */}
      {step === "upload" && (
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-bg-card/40 p-10 text-center transition-all duration-300 hover:bg-bg-card/60 ${
            isDragging
              ? "border-accent-indigo bg-accent-indigo/5"
              : "border-border-card hover:border-border-card-hover"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              handleFiles(Array.from(e.dataTransfer.files));
            }
          }}
        >
          <input
            type="file"
            accept=".pdf,.txt,.md"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(Array.from(e.target.files));
                e.target.value = "";
              }
            }}
          />

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-accent-indigo/20 bg-accent-indigo/10">
            <svg
              className="h-7 w-7 text-accent-indigo"
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
            Drop a file here{" "}
            <span className="text-accent-indigo">or click to browse</span>
          </p>
          <p className="mt-1.5 text-xs text-text-muted">
            Supports PDF, TXT, and Markdown files
          </p>
        </div>
      )}

      {/* Step: Configure */}
      {step === "configure" && file && (
        <>
          {/* File info */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-indigo/10">
                  <svg
                    className="h-5 w-5 text-accent-indigo"
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
                <div>
                  <p className="text-sm font-medium text-text-primary">{file.name}</p>
                  <p className="text-xs text-text-muted">{formatSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-text-muted transition-colors hover:text-accent-indigo"
              >
                Change file
              </button>
            </div>
          </div>

          {/* Entity type selection */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-1 text-sm font-semibold text-text-primary">
              What to Redact
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              Select the types of sensitive information to detect
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ENTITY_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => toggleEntityType(opt.type)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${
                    selectedTypes.includes(opt.type)
                      ? "border-accent-indigo/30 bg-accent-indigo/10 text-text-primary"
                      : "border-border-card bg-bg-secondary text-text-muted hover:border-border-card-hover hover:text-text-secondary"
                  }`}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10px] text-text-muted">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Engine selection */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-1 text-sm font-semibold text-text-primary">
              Detection Engine
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              Choose between speed and accuracy
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEngine("compromise")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  engine === "compromise"
                    ? "border-accent-indigo/30 bg-accent-indigo/10"
                    : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      engine === "compromise"
                        ? "border-accent-indigo bg-accent-indigo"
                        : "border-text-muted"
                    }`}
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Compromise.js
                  </span>
                  <span className="rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-green">
                    Fast
                  </span>
                </div>
                <p className="pl-5 text-[10px] text-text-muted">
                  Rule-based NLP library. Fast and runs instantly. Good for common
                  patterns.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEngine("transformers")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  engine === "transformers"
                    ? "border-accent-indigo/30 bg-accent-indigo/10"
                    : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      engine === "transformers"
                        ? "border-accent-indigo bg-accent-indigo"
                        : "border-text-muted"
                    }`}
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Transformers.js
                  </span>
                  <span className="rounded bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-orange">
                    ML Model
                  </span>
                </div>
                <p className="pl-5 text-[10px] text-text-muted">
                  BERT-based NER model. More accurate but slower on first load
                  (~30MB download).
                </p>
              </button>
            </div>
          </div>

          {/* Redaction style — only for text/md files; PDFs always use black box */}
          {isPdf ? (
            <div className="rounded-xl border border-border-card bg-bg-card p-5">
              <h3 className="font-display mb-1 text-sm font-semibold text-text-primary">
                Redaction Style
              </h3>
              <p className="text-xs text-text-muted">
                PDF redactions use black box overlay — the original text is permanently
                removed and replaced with an opaque rectangle.
              </p>
            </div>
          ) : (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-1 text-sm font-semibold text-text-primary">
              Redaction Style
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              How redacted content should appear
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStyle("placeholder")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  style === "placeholder"
                    ? "border-accent-indigo/30 bg-accent-indigo/10"
                    : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      style === "placeholder"
                        ? "border-accent-indigo bg-accent-indigo"
                        : "border-text-muted"
                    }`}
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Placeholders
                  </span>
                </div>
                <p className="pl-5 font-mono text-[10px] text-text-muted">
                  John Smith &rarr; [NAME]
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStyle("blackbox")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  style === "blackbox"
                    ? "border-accent-indigo/30 bg-accent-indigo/10"
                    : "border-border-card bg-bg-secondary hover:border-border-card-hover"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      style === "blackbox"
                        ? "border-accent-indigo bg-accent-indigo"
                        : "border-text-muted"
                    }`}
                  />
                  <span className="text-xs font-semibold text-text-primary">
                    Black Box
                  </span>
                </div>
                <p className="pl-5 font-mono text-[10px] text-text-muted">
                  John Smith &rarr; {"\u2588\u2588\u2588\u2588\u2588\u2588"}
                </p>
              </button>
            </div>
          </div>
          )}

          {/* Scan button */}
          <button
            type="button"
            onClick={runDetection}
            disabled={isProcessing || selectedTypes.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-indigo px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-indigo/80 hover:shadow-[0_0_24px_rgba(99,102,241,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isProcessing ? processingStatus || "Processing..." : "Scan for Sensitive Information"}
          </button>
        </>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <>
          {/* Entity summary */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Detected Entities
              </h3>
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="text-xs text-text-muted transition-colors hover:text-accent-indigo"
              >
                Re-scan
              </button>
            </div>

            {entities.length === 0 ? (
              <p className="text-xs text-text-muted">
                No sensitive information detected with current settings.
              </p>
            ) : (
              <>
                {/* Entity count badges */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(
                    entities.reduce(
                      (acc, e) => {
                        acc[e.type] = (acc[e.type] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>
                    )
                  ).map(([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1 rounded-full border border-accent-indigo/20 bg-accent-indigo/10 px-2.5 py-1 text-[10px] font-medium text-accent-indigo"
                    >
                      {ENTITY_OPTIONS.find((e) => e.type === type)?.label ?? type}
                      <span className="font-mono">{count}</span>
                    </span>
                  ))}
                </div>

                {/* Entity list */}
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {entities.map((entity, i) => (
                    <div
                      key={`${entity.start}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-1.5"
                    >
                      <span className="shrink-0 rounded bg-accent-indigo/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-accent-indigo">
                        {entity.type}
                      </span>
                      <span className="truncate font-mono text-xs text-text-secondary">
                        {entity.text}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Preview diff */}
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-3 text-sm font-semibold text-text-primary">
              Preview
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-lg bg-bg-secondary p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
                {redactedText || extractedText}
              </pre>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-accent-orange/20 bg-accent-orange/5 p-3">
            <p className="text-xs text-accent-orange">
              <span className="font-semibold">Note:</span> Automated redaction
              may not catch all sensitive information. Always review the results
              before sharing.
            </p>
          </div>

          {/* Apply button */}
          <button
            type="button"
            onClick={handleRedact}
            disabled={isProcessing || entities.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-indigo px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-indigo/80 hover:shadow-[0_0_24px_rgba(99,102,241,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isProcessing
              ? processingStatus || "Applying..."
              : `Apply ${entities.length} Redaction${entities.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <>
          {/* Success */}
          <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green/10">
                <svg
                  className="h-5 w-5 text-accent-green"
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
              <div>
                <p className="text-sm font-semibold text-accent-green">
                  Redaction Complete
                </p>
                <p className="text-xs text-text-muted">
                  {entities.length} item{entities.length !== 1 ? "s" : ""} redacted
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-accent-green/20 bg-bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">
                  {result.name}
                </p>
                <p className="text-[10px] text-text-muted">
                  {formatSize(result.buffer.byteLength)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadBlob(result.blob, result.name)}
                className="shrink-0 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-2 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/20"
              >
                Download
              </button>
            </div>
          </div>

          {/* Redact another */}
          <button
            type="button"
            onClick={reset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-card bg-bg-card px-5 py-3 text-sm font-medium text-text-secondary transition-all hover:bg-bg-card-hover"
          >
            Redact Another File
          </button>
        </>
      )}
    </div>
  );
}
