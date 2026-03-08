import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { validateSvg, hasAnimation } from "../../lib/svg";

type BgMode = "dark" | "light" | "checker";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <circle cx="100" cy="100" r="80" fill="#a855f7" opacity="0.8">
    <animate attributeName="r" values="80;60;80" dur="2s" repeatCount="indefinite"/>
  </circle>
  <circle cx="100" cy="100" r="50" fill="#06b6d4" opacity="0.8">
    <animate attributeName="r" values="50;70;50" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>`;

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

export default function SvgViewerTool() {
  const [svgCode, setSvgCode] = useState("");
  const [bgMode, setBgMode] = useState<BgMode>("checker");
  const [zoom, setZoom] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isPlaceholder = !svgCode;
  const displayCode = svgCode || SAMPLE_SVG;

  // Validate SVG and build blob URL as image/svg+xml (native XML parsing)
  useEffect(() => {
    const validationError = validateSvg(displayCode);
    setError(isPlaceholder ? null : validationError);

    if (validationError && !isPlaceholder) {
      setBlobUrl(null);
      return;
    }

    // Serve as image/svg+xml so the browser parses it as native XML —
    // CDATA, xmlns:xlink, namespaces, etc. all work correctly.
    const blob = new Blob([displayCode], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [displayCode, isPlaceholder]);

  // Detect if SVG has animations
  const isAnimated = useMemo(() => {
    return hasAnimation(displayCode);
  }, [displayCode]);

  // Toggle animation pause/play via iframe document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const toggle = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const svgEl = doc.querySelector("svg") ?? doc.documentElement;
        if (!svgEl || typeof (svgEl as SVGSVGElement).pauseAnimations !== "function") return;

        if (isPaused) {
          (svgEl as SVGSVGElement).pauseAnimations();
          svgEl.style.animationPlayState = "paused";
          svgEl.querySelectorAll("*").forEach((el) => {
            (el as HTMLElement).style.animationPlayState = "paused";
          });
        } else {
          (svgEl as SVGSVGElement).unpauseAnimations();
          svgEl.style.animationPlayState = "running";
          svgEl.querySelectorAll("*").forEach((el) => {
            (el as HTMLElement).style.animationPlayState = "running";
          });
        }
      } catch {
        // cross-origin safety
      }
    };

    iframe.addEventListener("load", toggle);
    toggle();
    return () => iframe.removeEventListener("load", toggle);
  }, [isPaused, blobUrl]);

  const handleCopy = useCallback(() => {
    if (!svgCode) return;
    navigator.clipboard.writeText(svgCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [svgCode]);

  const handleDownload = useCallback(() => {
    if (!svgCode) return;
    const blob = new Blob([svgCode], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [svgCode]);

  const handleLoadSample = useCallback(() => {
    setSvgCode(SAMPLE_SVG);
    setIsPaused(false);
  }, []);

  return (
    <div className="space-y-5">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Background toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Background:</span>
          <div className="inline-flex rounded-lg border border-border-card bg-bg-secondary p-0.5">
            {(["dark", "light", "checker"] as BgMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setBgMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  bgMode === mode
                    ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25"
                    : "text-text-muted hover:text-text-secondary border border-transparent"
                }`}
              >
                {mode === "checker" ? "Checker" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Zoom:</span>
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 25))}
            className="flex h-6 w-6 items-center justify-center rounded border border-border-card bg-bg-secondary text-xs text-text-muted transition-colors hover:text-text-secondary hover:border-border-card-hover"
          >
            -
          </button>
          <span className="min-w-[3rem] text-center text-xs font-mono text-text-secondary">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(400, z + 25))}
            className="flex h-6 w-6 items-center justify-center rounded border border-border-card bg-bg-secondary text-xs text-text-muted transition-colors hover:text-text-secondary hover:border-border-card-hover"
          >
            +
          </button>
          <button
            onClick={() => setZoom(100)}
            className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary"
          >
            Reset
          </button>
        </div>

        {/* Animation controls */}
        {isAnimated && (
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
              isPaused
                ? "border-accent-orange/25 bg-accent-orange/10 text-accent-orange"
                : "border-accent-green/25 bg-accent-green/10 text-accent-green"
            }`}
          >
            {isPaused ? (
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
            {isPaused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      {/* Preview area */}
      <div
        className="relative overflow-hidden rounded-xl border border-border-card"
        style={{ minHeight: "300px", maxHeight: "500px" }}
      >
        {isPlaceholder && !blobUrl && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg-primary/80 backdrop-blur-sm">
            <svg
              className="h-10 w-10 text-text-muted/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
            <p className="text-sm text-text-muted">Paste SVG code below to preview</p>
            <button
              onClick={handleLoadSample}
              className="text-xs text-accent-cyan/70 transition-colors hover:text-accent-cyan"
            >
              or try a sample SVG
            </button>
          </div>
        )}
        {/* Background container behind the iframe */}
        <div
          className="flex items-center justify-center overflow-auto"
          style={{ ...BG_STYLES[bgMode], minHeight: "300px", maxHeight: "500px" }}
        >
          {blobUrl && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="SVG Preview"
              sandbox="allow-same-origin"
              className="block border-0"
              style={{
                width: "100%",
                height: "300px",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center center",
                background: "transparent",
              }}
            />
          )}
        </div>
        {error && !isPlaceholder && (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            {error}
          </div>
        )}
      </div>

      {/* SVG Code input */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">SVG Code</label>
          <div className="flex gap-2">
            {isAnimated && !isPlaceholder && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-cyan/10 px-2 py-0.5 text-xs text-accent-cyan">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Animated
              </span>
            )}
            <button
              onClick={handleCopy}
              disabled={!svgCode}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-40 disabled:pointer-events-none"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                    />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              disabled={!svgCode}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-cyan hover:bg-accent-cyan/10 disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Download
            </button>
          </div>
        </div>
        <textarea
          value={svgCode}
          onChange={(e) => {
            setSvgCode(e.target.value);
            setIsPaused(false);
          }}
          placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>'}
          rows={10}
          className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition-colors resize-y"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
