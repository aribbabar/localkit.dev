import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_QR_CODE_GENERATOR_DATA,
  DEFAULT_QR_CODE_GENERATOR_PREFERENCES,
  loadQrCodeGeneratorPreferences,
  saveQrCodeGeneratorPreferences,
  type QrCodeGeneratorPreferences,
  type QrCornerDotType,
  type QrCornerSquareType,
  type QrDotType,
  type QrErrorCorrectionLevel,
  type QrExportExtension,
  type QrShape,
} from "./preferences";

type QrCodeStylingInstance = {
  append: (container: HTMLElement) => void;
  download: (options: {
    name?: string;
    extension?: QrExportExtension;
  }) => Promise<void>;
};

const DOT_OPTIONS: Array<{ value: QrDotType; label: string }> = [
  { value: "rounded", label: "Rounded" },
  { value: "dots", label: "Dots" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy round" },
  { value: "square", label: "Square" },
  { value: "extra-rounded", label: "Extra round" },
];

const CORNER_SQUARE_OPTIONS: Array<{
  value: QrCornerSquareType;
  label: string;
}> = [
  { value: "extra-rounded", label: "Extra round" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "square", label: "Square" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy round" },
];

const CORNER_DOT_OPTIONS: Array<{ value: QrCornerDotType; label: string }> = [
  { value: "dot", label: "Dot" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "dots", label: "Dots" },
  { value: "classy", label: "Classy" },
  { value: "classy-rounded", label: "Classy round" },
];

const ERROR_CORRECTION_OPTIONS: Array<{
  value: QrErrorCorrectionLevel;
  label: string;
  detail: string;
}> = [
  { value: "L", label: "Low", detail: "7%" },
  { value: "M", label: "Medium", detail: "15%" },
  { value: "Q", label: "Quartile", detail: "25%" },
  { value: "H", label: "High", detail: "30%" },
];

const EXPORT_OPTIONS: Array<{ value: QrExportExtension; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
];

export default function QrCodeGeneratorApp() {
  const savedPreferences = useMemo(loadQrCodeGeneratorPreferences, []);
  const [data, setData] = useState(DEFAULT_QR_CODE_GENERATOR_DATA);
  const [preferences, setPreferences] = useState(savedPreferences);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState("Style preferences save automatically.");
  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QrCodeStylingInstance | null>(null);

  const effectiveImageUrl = uploadedImageUrl || preferences.imageUrl.trim();

  useEffect(() => {
    saveQrCodeGeneratorPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    return () => {
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    };
  }, [uploadedImageUrl]);

  useEffect(() => {
    let cancelled = false;

    async function renderQrCode() {
      const container = previewRef.current;
      if (!container) return;

      setIsReady(false);
      try {
        const { default: QRCodeStyling } = await import("qr-code-styling");
        if (cancelled) return;

        container.innerHTML = "";
        const qrCode = new QRCodeStyling({
          width: preferences.size,
          height: preferences.size,
          type: "svg",
          shape: preferences.shape,
          data: data.trim() || " ",
          image: effectiveImageUrl || undefined,
          margin: preferences.margin,
          qrOptions: {
            errorCorrectionLevel: preferences.errorCorrectionLevel,
          },
          dotsOptions: {
            color: preferences.dotColor,
            type: preferences.dotType,
          },
          cornersSquareOptions: {
            color: preferences.cornerSquareColor,
            type: preferences.cornerSquareType,
          },
          cornersDotOptions: {
            color: preferences.cornerDotColor,
            type: preferences.cornerDotType,
          },
          backgroundOptions: {
            color: preferences.backgroundColor,
          },
          imageOptions: {
            crossOrigin: "anonymous",
            hideBackgroundDots: preferences.hideBackgroundDots,
            imageSize: preferences.imageSize,
            margin: preferences.imageMargin,
            saveAsBlob: Boolean(uploadedImageUrl),
          },
        });

        qrCode.append(container);
        Array.from(container.children).forEach((child) => {
          child.setAttribute(
            "style",
            "display:block;max-width:100%;height:auto;",
          );
        });

        qrRef.current = qrCode;
        setIsReady(true);
        setStatus("QR code updated.");
      } catch {
        if (!cancelled) {
          setStatus("Could not render the QR code with these settings.");
        }
      }
    }

    renderQrCode();

    return () => {
      cancelled = true;
    };
  }, [data, effectiveImageUrl, preferences, uploadedImageUrl]);

  function updatePreference<K extends keyof QrCodeGeneratorPreferences>(
    key: K,
    value: QrCodeGeneratorPreferences[K],
  ) {
    setPreferences((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetToDefaults() {
    setData(DEFAULT_QR_CODE_GENERATOR_DATA);
    setPreferences(DEFAULT_QR_CODE_GENERATOR_PREFERENCES);
    setUploadedImageUrl("");
    setStatus("Defaults restored.");
  }

  function useUploadedLogo(file: File | undefined) {
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setUploadedImageUrl(nextUrl);
    setStatus("Logo added to preview.");
  }

  function removeUploadedLogo() {
    setUploadedImageUrl("");
    setStatus("Uploaded logo removed.");
  }

  async function downloadQrCode() {
    if (!qrRef.current || !isReady) return;
    setStatus("Preparing download...");
    try {
      await qrRef.current.download({
        name: "localkit-qr-code",
        extension: preferences.exportExtension,
      });
      setStatus(
        `Downloaded ${preferences.exportExtension.toUpperCase()} file.`,
      );
    } catch {
      setStatus("Download failed. Try removing the logo or using PNG.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border-card bg-bg-card/80 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-teal">
              QR content
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
              Encode text or a URL
            </h2>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="rounded-full border border-border-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
          >
            Reset
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-medium text-text-secondary">
            QR data
          </span>
          <textarea
            value={data}
            onChange={(event) => setData(event.target.value)}
            spellCheck={false}
            className="min-h-32 w-full resize-y rounded-xl border border-border-card bg-bg-secondary/70 p-3 font-mono text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
            placeholder="https://example.com or any text"
          />
        </label>

        <div className="mt-5 space-y-5">
          <NumberSlider
            label="Size"
            min={160}
            max={720}
            value={preferences.size}
            suffix="px"
            onChange={(value) => updatePreference("size", value)}
          />

          <NumberSlider
            label="Margin"
            min={0}
            max={80}
            value={preferences.margin}
            suffix="px"
            onChange={(value) => updatePreference("margin", value)}
          />

          <SegmentedControl
            label="Shape"
            options={[
              { value: "square" as QrShape, label: "Square" },
              { value: "circle" as QrShape, label: "Circle" },
            ]}
            value={preferences.shape}
            onChange={(value) => updatePreference("shape", value)}
          />

          <SegmentedControl
            label="Error correction"
            options={ERROR_CORRECTION_OPTIONS}
            value={preferences.errorCorrectionLevel}
            onChange={(value) =>
              updatePreference("errorCorrectionLevel", value)
            }
          />
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-border-card bg-bg-card/80 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-border-card bg-white p-5">
            <div
              ref={previewRef}
              className="flex aspect-square w-full max-w-[440px] items-center justify-center"
              aria-live="polite"
            />
          </div>

          <div className="w-full lg:w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-teal">
              Export
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
              Download QR code
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">{status}</p>

            <div className="mt-5">
              <SegmentedControl
                label="File type"
                options={EXPORT_OPTIONS}
                value={preferences.exportExtension}
                onChange={(value) => updatePreference("exportExtension", value)}
              />
            </div>

            <button
              type="button"
              onClick={downloadQrCode}
              disabled={!isReady}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent-teal/25 bg-accent-teal/10 px-4 py-2.5 text-sm font-medium text-accent-teal transition-colors hover:bg-accent-teal/15 disabled:pointer-events-none disabled:opacity-50"
            >
              Download
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <StylePanel title="Dots">
            <SegmentedControl
              label="Dot style"
              options={DOT_OPTIONS}
              value={preferences.dotType}
              onChange={(value) => updatePreference("dotType", value)}
            />
            <ColorInput
              label="Dot color"
              value={preferences.dotColor}
              onChange={(value) => updatePreference("dotColor", value)}
            />
          </StylePanel>

          <StylePanel title="Corners">
            <SegmentedControl
              label="Corner square"
              options={CORNER_SQUARE_OPTIONS}
              value={preferences.cornerSquareType}
              onChange={(value) => updatePreference("cornerSquareType", value)}
            />
            <ColorInput
              label="Square color"
              value={preferences.cornerSquareColor}
              onChange={(value) => updatePreference("cornerSquareColor", value)}
            />
            <SegmentedControl
              label="Corner dot"
              options={CORNER_DOT_OPTIONS}
              value={preferences.cornerDotType}
              onChange={(value) => updatePreference("cornerDotType", value)}
            />
            <ColorInput
              label="Dot color"
              value={preferences.cornerDotColor}
              onChange={(value) => updatePreference("cornerDotColor", value)}
            />
          </StylePanel>

          <StylePanel title="Background">
            <ColorInput
              label="Background color"
              value={preferences.backgroundColor}
              onChange={(value) => updatePreference("backgroundColor", value)}
            />
          </StylePanel>

          <StylePanel title="Logo">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text-secondary">
                Logo URL
              </span>
              <input
                type="url"
                value={preferences.imageUrl}
                onChange={(event) =>
                  updatePreference("imageUrl", event.target.value)
                }
                placeholder="https://example.com/logo.svg"
                className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text-secondary">
                Upload logo
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => useUploadedLogo(event.target.files?.[0])}
                className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-accent-teal/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent-teal"
              />
            </label>

            {uploadedImageUrl && (
              <button
                type="button"
                onClick={removeUploadedLogo}
                className="rounded-full border border-border-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
              >
                Remove uploaded logo
              </button>
            )}

            <NumberSlider
              label="Logo size"
              min={10}
              max={50}
              value={Math.round(preferences.imageSize * 100)}
              suffix="%"
              onChange={(value) => updatePreference("imageSize", value / 100)}
            />

            <NumberSlider
              label="Logo margin"
              min={0}
              max={40}
              value={preferences.imageMargin}
              suffix="px"
              onChange={(value) => updatePreference("imageMargin", value)}
            />

            <ToggleRow
              checked={preferences.hideBackgroundDots}
              label="Hide dots under logo"
              onChange={(checked) =>
                updatePreference("hideBackgroundDots", checked)
              }
            />
          </StylePanel>
        </div>
      </section>
    </div>
  );
}

function StylePanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-secondary/45 p-4">
      <h3 className="font-display text-sm font-semibold text-text-primary">
        {title}
      </h3>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; detail?: string }>;
  value: T;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
              value === option.value
                ? "border-accent-teal/35 bg-accent-teal/10 text-accent-teal"
                : "border-border-card bg-bg-secondary text-text-secondary hover:border-border-card-hover hover:text-text-primary"
            }`}
          >
            <span className="block">{option.label}</span>
            {option.detail && (
              <span className="mt-0.5 block text-[10px] text-current/70">
                {option.detail}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberSlider({
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-text-secondary">
          {label}
        </label>
        <span className="rounded-md border border-border-card bg-bg-secondary px-2.5 py-0.5 font-mono text-sm text-text-primary">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-[var(--color-accent-teal)]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-text-muted">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          {max}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-text-secondary">
        {label}
      </span>
      <span className="flex items-center gap-3 rounded-lg border border-border-card bg-bg-secondary px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-text-primary outline-none"
        />
      </span>
    </label>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        checked
          ? "border-accent-teal/35 bg-accent-teal/10 text-accent-teal"
          : "border-border-card bg-bg-secondary text-text-secondary hover:border-border-card-hover hover:text-text-primary"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
          checked
            ? "border-current bg-current/10"
            : "border-border-card bg-bg-primary"
        }`}
      >
        <span
          className={`absolute h-3.5 w-3.5 rounded-full transition-transform ${
            checked
              ? "translate-x-4 bg-current"
              : "translate-x-0.5 bg-text-muted"
          }`}
        />
      </span>
    </button>
  );
}
