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
import styles from "./QrCodeGenerator.module.css";

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

const segmentedButtonClass = (
  active: boolean,
  detail: boolean = false,
): string =>
  [
    "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
    active
      ? "border-accent-teal/35 bg-accent-teal/10 text-accent-teal"
      : "border-border-card bg-bg-secondary text-text-secondary hover:border-border-card-hover hover:text-text-primary",
    detail ? "" : "",
  ].join(" ");

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
    <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
      {/* Top bar: QR content + shape */}
      <section
        aria-label="QR content"
        className="flex flex-col gap-3.5 rounded-2xl border border-border-card bg-bg-card/80 p-4 lg:col-span-3"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-teal">
              QR content
            </p>
            <h2 className="mt-1 font-display text-base font-bold text-text-primary">
              Encode text or a URL
            </h2>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center gap-2 rounded-full border border-border-card bg-transparent px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
          >
            Reset
          </button>
        </header>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="qr-data"
            className="text-xs font-medium text-text-secondary"
          >
            Data
          </label>
          <textarea
            id="qr-data"
            value={data}
            onChange={(event) => setData(event.target.value)}
            spellCheck={false}
            placeholder="https://example.com or any text"
            className="min-h-18 w-full resize-y rounded-xl border border-border-card bg-bg-secondary/70 px-3 py-2.5 font-mono text-[0.8125rem] leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-text-secondary">
            Shape
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
            {(
              [
                { value: "square", label: "Square" },
                { value: "circle", label: "Circle" },
              ] satisfies Array<{ value: QrShape; label: string }>
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updatePreference("shape", option.value)}
                aria-pressed={preferences.shape === option.value}
                className={segmentedButtonClass(
                  preferences.shape === option.value,
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Left panel: visual style */}
      <section
        aria-label="QR style"
        className="flex flex-col gap-3.5 rounded-2xl border border-border-card bg-bg-card/80 p-4 lg:row-start-2"
      >
        <header>
          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-teal">
            Style
          </p>
          <h2 className="mt-1 font-display text-base font-bold text-text-primary">
            Dots, corners &amp; background
          </h2>
        </header>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-text-secondary">
            Dots
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
            {DOT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updatePreference("dotType", option.value)}
                aria-pressed={preferences.dotType === option.value}
                className={segmentedButtonClass(
                  preferences.dotType === option.value,
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <ColorInput
          label="Dot color"
          value={preferences.dotColor}
          onChange={(value) => updatePreference("dotColor", value)}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-text-secondary">
            Corner square
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
            {CORNER_SQUARE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updatePreference("cornerSquareType", option.value)
                }
                aria-pressed={preferences.cornerSquareType === option.value}
                className={segmentedButtonClass(
                  preferences.cornerSquareType === option.value,
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <ColorInput
          label="Corner square color"
          value={preferences.cornerSquareColor}
          onChange={(value) => updatePreference("cornerSquareColor", value)}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-text-secondary">
            Corner dot
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
            {CORNER_DOT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updatePreference("cornerDotType", option.value)}
                aria-pressed={preferences.cornerDotType === option.value}
                className={segmentedButtonClass(
                  preferences.cornerDotType === option.value,
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <ColorInput
          label="Corner dot color"
          value={preferences.cornerDotColor}
          onChange={(value) => updatePreference("cornerDotColor", value)}
        />

        <ColorInput
          label="Background"
          value={preferences.backgroundColor}
          onChange={(value) => updatePreference("backgroundColor", value)}
        />
      </section>

      {/* Center stage: preview + size/margin + error correction */}
      <section
        aria-label="QR preview"
        className="flex min-w-0 items-center justify-center lg:row-start-2"
      >
        <div>
          <div
            ref={previewRef}
            aria-live="polite"
            className={`${styles.stageSurface} flex aspect-square w-[clamp(260px,38vw,460px)] items-center justify-center rounded-2xl border border-border-card p-5 [&>div]:flex [&>div]:h-full [&>div]:w-full [&>div]:items-center [&>div]:justify-center [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_canvas]:block [&_canvas]:h-auto [&_canvas]:max-w-full`}
          />
          <p className="mt-3 min-h-4 text-center text-xs text-text-muted">
            {status}
          </p>

          <div className="mt-3.5 grid w-[clamp(260px,38vw,460px)] gap-3">
            <NumberSlider
              label="Size"
              min={160}
              max={720}
              suffix="px"
              value={preferences.size}
              onChange={(value) => updatePreference("size", value)}
            />
            <NumberSlider
              label="Margin"
              min={0}
              max={80}
              suffix="px"
              value={preferences.margin}
              onChange={(value) => updatePreference("margin", value)}
            />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-text-secondary">
                Error correction
              </legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
                {ERROR_CORRECTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updatePreference("errorCorrectionLevel", option.value)
                    }
                    aria-pressed={
                      preferences.errorCorrectionLevel === option.value
                    }
                    className={segmentedButtonClass(
                      preferences.errorCorrectionLevel === option.value,
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="text-[0.625rem] opacity-75">
                      {option.detail}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </section>

      {/* Right panel: logo controls */}
      <section
        aria-label="Logo options"
        className="flex flex-col gap-3.5 rounded-2xl border border-border-card bg-bg-card/80 p-4 lg:row-start-2"
      >
        <header>
          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-teal">
            Logo
          </p>
          <h2 className="mt-1 font-display text-base font-bold text-text-primary">
            Overlay a brand mark
          </h2>
        </header>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="logo-url"
            className="text-xs font-medium text-text-secondary"
          >
            Logo URL
          </label>
          <input
            id="logo-url"
            type="url"
            value={preferences.imageUrl}
            onChange={(event) =>
              updatePreference("imageUrl", event.target.value)
            }
            placeholder="https://example.com/logo.svg"
            className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-1.5 text-[0.8125rem] text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="logo-upload"
            className="text-xs font-medium text-text-secondary"
          >
            Upload logo
          </label>
          <input
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => useUploadedLogo(event.target.files?.[0])}
            className="w-full rounded-lg border border-border-card bg-bg-secondary px-2 py-1.5 text-xs text-text-secondary outline-none file:mr-2.5 file:rounded-full file:border-0 file:bg-accent-teal/10 file:px-3 file:py-1 file:text-[0.6875rem] file:font-medium file:text-accent-teal"
          />
        </div>

        {uploadedImageUrl && (
          <button
            type="button"
            onClick={removeUploadedLogo}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border-card bg-transparent px-3.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
          >
            Remove uploaded logo
          </button>
        )}

        <NumberSlider
          label="Logo size"
          min={10}
          max={50}
          suffix="%"
          value={Math.round(preferences.imageSize * 100)}
          onChange={(value) => updatePreference("imageSize", value / 100)}
        />

        <NumberSlider
          label="Logo margin"
          min={0}
          max={40}
          suffix="px"
          value={preferences.imageMargin}
          onChange={(value) => updatePreference("imageMargin", value)}
        />

        <ToggleRow
          checked={preferences.hideBackgroundDots}
          label="Hide dots under logo"
          onChange={(checked) =>
            updatePreference("hideBackgroundDots", checked)
          }
        />
      </section>

      {/* Bottom bar: export + download */}
      <section
        aria-label="Export"
        className="flex flex-col gap-3.5 rounded-2xl border border-border-card bg-bg-card/80 p-4 lg:col-span-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="m-0 min-w-48 flex-1 text-xs text-text-muted">
            {isReady
              ? `Ready to download as ${preferences.exportExtension.toUpperCase()}.`
              : "Rendering preview..."}
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="flex min-w-64 flex-col gap-1.5">
              <legend className="text-xs font-medium text-text-secondary">
                File type
              </legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] gap-1.5">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updatePreference("exportExtension", option.value)
                    }
                    aria-pressed={preferences.exportExtension === option.value}
                    className={segmentedButtonClass(
                      preferences.exportExtension === option.value,
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={downloadQrCode}
              disabled={!isReady}
              className="inline-flex items-center gap-2 rounded-full border border-accent-teal/25 bg-accent-teal/10 px-5 py-2 text-[0.8125rem] font-medium text-accent-teal transition-colors hover:bg-accent-teal/15 disabled:pointer-events-none disabled:opacity-50"
            >
              Download QR code
            </button>
          </div>
        </div>
      </section>
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <span className="rounded-md border border-border-card bg-bg-secondary px-2.5 py-0.5 font-mono text-xs text-text-primary">
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
        className={styles.range}
      />
      <div className="flex justify-between font-mono text-[0.625rem] text-text-muted">
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <span className="flex items-center gap-2 rounded-lg border border-border-card bg-bg-secondary px-2 py-1">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color picker`}
          className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label={`${label} hex value`}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-text-primary outline-none"
        />
      </span>
    </div>
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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
        checked
          ? "border-accent-teal/35 bg-accent-teal/10 text-accent-teal"
          : "border-border-card bg-bg-secondary text-text-secondary hover:border-border-card-hover hover:text-text-primary"
      }`}
    >
      <span className="text-xs font-medium">{label}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-[1.125rem] w-8 items-center rounded-full border ${
          checked
            ? "border-current bg-current/10"
            : "border-border-card bg-bg-primary"
        }`}
      >
        <span
          className={`absolute h-[0.8125rem] w-[0.8125rem] rounded-full transition-transform ${
            checked
              ? "translate-x-[calc(2rem-0.8125rem-2px)] bg-current"
              : "translate-x-0.5 bg-text-muted"
          }`}
        />
      </span>
    </button>
  );
}
