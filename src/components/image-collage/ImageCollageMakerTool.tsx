import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from "react";
import {
  createCollageLayout,
  type CollageLayout,
  type CollageRatioPreset,
} from "../../lib/image-collage";
import {
  DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES,
  MAX_IMAGE_COLLAGE_VIEWER_ZOOM,
  MIN_IMAGE_COLLAGE_VIEWER_ZOOM,
  loadImageCollageMakerPreferences,
  saveImageCollageMakerPreferences,
  type ImageCollageFitMode,
  type ImageCollageOutputFormat,
} from "./preferences";
import { centerTransform, zoomToPoint, type ViewerTransform } from "./viewer";
import styles from "./ImageCollageMakerTool.module.css";

interface CollagePhoto {
  id: string;
  file: File;
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
}

type DragHandle =
  | {
      type: "vertical";
      row: number;
      column: number;
      startClientX: number;
      baseLayout: CollageLayout;
    }
  | {
      type: "horizontal";
      row: number;
      startClientY: number;
      baseLayout: CollageLayout;
    };

interface PanDrag {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

interface PreviewViewportSize {
  width: number;
  height: number;
}

const ACCEPTED_INPUTS = "image/png,image/jpeg,image/webp,image/gif,image/bmp";
const MIN_TILE_SIZE = 48;
const ZOOM_STEP = 10;
const PREVIEW_VIEWPORT_HEIGHT = "70vh";

const ratioOptions: Array<{ value: CollageRatioPreset; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "square", label: "1:1" },
  { value: "portrait", label: "4:5" },
  { value: "landscape", label: "16:9" },
  { value: "photo", label: "3:2" },
];

function isAcceptedImage(file: File) {
  return file.type.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(width: number, height: number) {
  return `${Math.round(width)} x ${Math.round(height)} px`;
}

function clampViewerZoom(value: number) {
  return Math.min(
    MAX_IMAGE_COLLAGE_VIEWER_ZOOM,
    Math.max(MIN_IMAGE_COLLAGE_VIEWER_ZOOM, Math.round(value)),
  );
}

function loadImageFile(file: File): Promise<CollagePhoto> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        size: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
        url,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = url;
  });
}

function cloneLayout(layout: CollageLayout): CollageLayout {
  return {
    ...layout,
    rows: layout.rows.map((row) => [...row]),
    tiles: layout.tiles.map((tile) => ({ ...tile })),
  };
}

export default function ImageCollageMakerTool() {
  const savedPreferences = useMemo(loadImageCollageMakerPreferences, []);
  const [photos, setPhotos] = useState<CollagePhoto[]>([]);
  const [layout, setLayout] = useState<CollageLayout | null>(null);
  const [ratioPreset, setRatioPreset] = useState<CollageRatioPreset>(
    savedPreferences.ratioPreset,
  );
  const [fitMode, setFitMode] = useState<ImageCollageFitMode>(
    savedPreferences.fitMode,
  );
  const [gap, setGap] = useState(savedPreferences.gap);
  const [cornerRadius, setCornerRadius] = useState(
    savedPreferences.cornerRadius,
  );
  const [backgroundColor, setBackgroundColor] = useState(
    savedPreferences.backgroundColor,
  );
  const [outputFormat, setOutputFormat] = useState<ImageCollageOutputFormat>(
    savedPreferences.outputFormat,
  );
  const [quality, setQuality] = useState(savedPreferences.quality);
  const [viewerZoom, setViewerZoom] = useState(savedPreferences.viewerZoom);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [previewViewportSize, setPreviewViewportSize] =
    useState<PreviewViewportSize>({
      width: 0,
      height: 0,
    });
  const [previewTransform, setPreviewTransform] = useState<ViewerTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: savedPreferences.viewerZoom / 100,
  });
  const [history, setHistory] = useState<CollageLayout[]>([]);
  const [future, setFuture] = useState<CollageLayout[]>([]);
  const [activeDrag, setActiveDrag] = useState<DragHandle | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const photosRef = useRef<CollagePhoto[]>([]);
  const viewerZoomRef = useRef(viewerZoom);
  const previewTransformRef = useRef(previewTransform);
  const panDragRef = useRef<PanDrag | null>(null);
  const hasInitializedTransformRef = useRef(false);

  const photoById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const hasPhotos = photos.length > 0;
  const hasLayout = layout !== null;
  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const previewBaseSize = useMemo(() => {
    if (!layout) return { width: 0, height: 0 };

    const aspectRatio = layout.width / layout.height;
    const availableWidth = previewViewportSize.width || 720;
    const availableHeight = previewViewportSize.height || 520;
    const padding = 32;
    const fitWidth = Math.max(0, availableWidth - padding);
    const fitHeight = Math.max(0, availableHeight - padding);

    if (fitWidth <= 0 || fitHeight <= 0) {
      return { width: 0, height: 0 };
    }

    const width = Math.max(160, Math.min(fitWidth, fitHeight * aspectRatio));
    return { width, height: width / aspectRatio };
  }, [layout, previewViewportSize.height, previewViewportSize.width]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    viewerZoomRef.current = viewerZoom;
  }, [viewerZoom]);

  useEffect(() => {
    previewTransformRef.current = previewTransform;
  }, [previewTransform]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    saveImageCollageMakerPreferences({
      ratioPreset,
      fitMode,
      gap,
      cornerRadius,
      backgroundColor,
      outputFormat,
      quality,
      viewerZoom,
    });
  }, [
    ratioPreset,
    fitMode,
    gap,
    cornerRadius,
    backgroundColor,
    outputFormat,
    quality,
    viewerZoom,
  ]);

  useEffect(() => {
    if (!photos.length) {
      setLayout(null);
      setHistory([]);
      setFuture([]);
      hasInitializedTransformRef.current = false;
      return;
    }

    const nextLayout = createCollageLayout(photos, { ratioPreset, gap });
    setLayout(nextLayout);
    setHistory([]);
    setFuture([]);
  }, [photos, ratioPreset, gap]);

  useLayoutEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || !layout) return;

    function measureViewport() {
      if (!viewport) return;

      setPreviewViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    }

    measureViewport();

    const resizeObserver = new ResizeObserver(measureViewport);
    resizeObserver.observe(viewport);
    window.addEventListener("resize", measureViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureViewport);
    };
  }, [layout?.height, layout?.width]);

  const resetView = useCallback(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || !previewBaseSize.width || !previewBaseSize.height) {
      const fallback = {
        offsetX: 0,
        offsetY: 0,
        scale: DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom / 100,
      };
      setPreviewTransform(fallback);
      previewTransformRef.current = fallback;
      setViewerZoom(DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom);
      viewerZoomRef.current =
        DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom;
      return;
    }

    const scale = DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom / 100;
    const transform = centerTransform({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      contentWidth: previewBaseSize.width,
      contentHeight: previewBaseSize.height,
      scale,
    });
    setPreviewTransform(transform);
    previewTransformRef.current = transform;
    setViewerZoom(DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom);
    viewerZoomRef.current = DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES.viewerZoom;
  }, [previewBaseSize.height, previewBaseSize.width]);

  useLayoutEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || !previewBaseSize.width || !previewBaseSize.height) return;
    if (hasInitializedTransformRef.current) return;

    const scale = viewerZoomRef.current / 100;
    const transform = centerTransform({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      contentWidth: previewBaseSize.width,
      contentHeight: previewBaseSize.height,
      scale,
    });
    setPreviewTransform(transform);
    previewTransformRef.current = transform;
    hasInitializedTransformRef.current = true;
  }, [previewBaseSize.height, previewBaseSize.width]);

  const pushHistory = useCallback((previousLayout: CollageLayout) => {
    setHistory((prev) => [...prev.slice(-24), cloneLayout(previousLayout)]);
    setFuture([]);
  }, []);

  async function addFiles(files: File[]) {
    const nextFiles = files.filter(isAcceptedImage);
    if (!nextFiles.length) return;

    setIsLoadingFiles(true);
    try {
      const loadedPhotos = await Promise.all(nextFiles.map(loadImageFile));
      setPhotos((prev) => [...prev, ...loadedPhotos]);
    } catch (err: any) {
      alert(err?.message ?? String(err));
    } finally {
      setIsLoadingFiles(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void addFiles(Array.from(e.target.files));
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
      void addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function clearPhotos() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setLayout(null);
    setHistory([]);
    setFuture([]);
  }

  function removePhoto(id: string) {
    const removedPhoto = photos.find((photo) => photo.id === id);
    if (removedPhoto) URL.revokeObjectURL(removedPhoto.url);
    setPhotos((prev) => prev.filter((photo) => photo.id !== id));
  }

  function regenerateLayout() {
    if (!photos.length) return;
    const nextLayout = createCollageLayout(photos, { ratioPreset, gap });
    if (layout) pushHistory(layout);
    setLayout(nextLayout);
  }

  function resetOptions() {
    const defaults = DEFAULT_IMAGE_COLLAGE_MAKER_PREFERENCES;
    setRatioPreset(defaults.ratioPreset);
    setFitMode(defaults.fitMode);
    setGap(defaults.gap);
    setCornerRadius(defaults.cornerRadius);
    setBackgroundColor(defaults.backgroundColor);
    setOutputFormat(defaults.outputFormat);
    setQuality(defaults.quality);
    setViewerZoom(defaults.viewerZoom);
  }

  function adjustViewerZoom(delta: number) {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    zoomPreviewAt(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      delta,
    );
  }

  function zoomPreviewAt(clientX: number, clientY: number, delta: number) {
    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const currentZoom = viewerZoomRef.current;
    const nextZoom = clampViewerZoom(currentZoom + delta);
    if (nextZoom === currentZoom) return;

    const viewportRect = viewport.getBoundingClientRect();
    const nextTransform = zoomToPoint({
      clientX,
      clientY,
      viewportRect,
      transform: previewTransformRef.current,
      nextScale: nextZoom / 100,
    });

    previewTransformRef.current = nextTransform;
    setPreviewTransform(nextTransform);
    viewerZoomRef.current = nextZoom;
    setViewerZoom(nextZoom);
  }

  function handlePreviewPanStart(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || activeDrag) return;
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest("button,input,select,textarea")
    ) {
      return;
    }

    const viewport = previewViewportRef.current;
    if (!viewport) return;

    e.preventDefault();
    viewport.setPointerCapture(e.pointerId);
    panDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: previewTransformRef.current.offsetX,
      startOffsetY: previewTransformRef.current.offsetY,
    };
    setIsPanning(true);
  }

  function handlePreviewPanMove(e: PointerEvent<HTMLDivElement>) {
    const panDrag = panDragRef.current;
    if (!panDrag || panDrag.pointerId !== e.pointerId) return;

    e.preventDefault();
    const next = {
      offsetX: panDrag.startOffsetX + (e.clientX - panDrag.startClientX),
      offsetY: panDrag.startOffsetY + (e.clientY - panDrag.startClientY),
      scale: previewTransformRef.current.scale,
    };
    previewTransformRef.current = next;
    setPreviewTransform(next);
  }

  function stopPreviewPan(e: PointerEvent<HTMLDivElement>) {
    const panDrag = panDragRef.current;
    const viewport = previewViewportRef.current;
    if (!panDrag || panDrag.pointerId !== e.pointerId) return;

    if (viewport?.hasPointerCapture(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
    panDragRef.current = null;
    setIsPanning(false);
  }

  function undo() {
    if (!layout || !history.length) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, cloneLayout(layout)]);
    setLayout(cloneLayout(previous));
  }

  function redo() {
    if (!layout || !future.length) return;
    const next = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setHistory((prev) => [...prev, cloneLayout(layout)]);
    setLayout(cloneLayout(next));
  }

  function startHandleDrag(
    e: PointerEvent<HTMLButtonElement>,
    drag: DragHandle,
  ) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag(drag);
  }

  useEffect(() => {
    const previewViewport = previewViewportRef.current;
    if (!previewViewport) return;

    function handleWheel(e: globalThis.WheelEvent) {
      e.preventDefault();
      zoomPreviewAt(
        e.clientX,
        e.clientY,
        e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP,
      );
    }

    previewViewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      previewViewport.removeEventListener("wheel", handleWheel);
    };
  }, [hasLayout]);

  useEffect(() => {
    if (!activeDrag || !previewRef.current) return;

    const drag = activeDrag;

    function handlePointerMove(e: globalThis.PointerEvent) {
      const preview = previewRef.current;
      if (!preview) return;

      const rect = preview.getBoundingClientRect();
      const scaleX = drag.baseLayout.width / rect.width;
      const scaleY = drag.baseLayout.height / rect.height;

      if (drag.type === "vertical") {
        const delta = (e.clientX - drag.startClientX) * scaleX;
        setLayout(
          resizeVerticalDivider(drag.baseLayout, drag.row, drag.column, delta),
        );
        return;
      }

      const delta = (e.clientY - drag.startClientY) * scaleY;
      setLayout(resizeHorizontalDivider(drag.baseLayout, drag.row, delta));
    }

    function handlePointerUp() {
      setLayout((current) => {
        if (!current) return current;
        if (
          JSON.stringify(current.tiles) !==
          JSON.stringify(drag.baseLayout.tiles)
        ) {
          pushHistory(drag.baseLayout);
        }
        return current;
      });
      setActiveDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeDrag, pushHistory]);

  async function exportCollage() {
    if (!layout || isExporting) return;

    setIsExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(layout.width);
      canvas.height = Math.round(layout.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const tile of layout.tiles) {
        const photo = photoById.get(tile.imageId);
        if (!photo) continue;
        const image = await loadHtmlImage(photo.url);
        drawTile(ctx, image, tile, {
          fitMode,
          cornerRadius,
          backgroundColor,
        });
      }

      const mimeType = `image/${outputFormat}`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Could not export the collage."));
          },
          mimeType,
          outputFormat === "png" ? undefined : quality / 100,
        );
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `localkit-collage.${outputFormat === "jpeg" ? "jpg" : outputFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err?.message ?? String(err)}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
      <div className="min-w-0 space-y-6">
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
            PNG, JPG, WebP, GIF, BMP and other browser-readable images
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {isLoadingFiles
              ? "Reading image dimensions..."
              : "Multiple files supported"}
          </p>
        </div>

        {hasPhotos && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Selected images{" "}
                <span className="text-text-muted">({photos.length})</span>
              </h3>
              <button
                type="button"
                onClick={clearPhotos}
                className="text-xs text-text-muted transition-colors hover:text-accent-red"
              >
                Clear all
              </button>
            </div>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative flex w-32 shrink-0 flex-col gap-1.5 rounded-lg border border-border-card bg-bg-secondary p-2"
                >
                  <div className="relative h-20 w-full overflow-hidden rounded-md bg-bg-primary">
                    <img
                      src={photo.url}
                      alt=""
                      className="block h-full w-full object-cover"
                      draggable={false}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-accent-red focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Remove ${photo.name}`}
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
                  <p
                    className="truncate text-[11px] font-medium text-text-primary"
                    title={photo.name}
                  >
                    {photo.name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {photo.width} x {photo.height} | {formatSize(photo.size)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {layout && (
          <div className="overflow-hidden rounded-xl border border-border-card bg-bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-card px-4 py-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-text-primary">
                  Collage Preview
                </h2>
                <p className="text-[10px] text-text-muted">
                  {formatDimensions(layout.width, layout.height)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  label="Zoom out"
                  disabled={viewerZoom <= MIN_IMAGE_COLLAGE_VIEWER_ZOOM}
                  onClick={() => adjustViewerZoom(-ZOOM_STEP)}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14"
                  />
                </IconButton>
                <button
                  type="button"
                  onClick={resetView}
                  className="min-w-14 rounded-lg border border-border-card bg-bg-secondary px-2 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
                  title="Reset view"
                >
                  {viewerZoom}%
                </button>
                <IconButton
                  label="Zoom in"
                  disabled={viewerZoom >= MAX_IMAGE_COLLAGE_VIEWER_ZOOM}
                  onClick={() => adjustViewerZoom(ZOOM_STEP)}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 5v14M5 12h14"
                  />
                </IconButton>
                <IconButton label="Undo" disabled={!canUndo} onClick={undo}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                  />
                </IconButton>
                <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
                  />
                </IconButton>
                <button
                  type="button"
                  onClick={regenerateLayout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
                >
                  Regenerate
                </button>
              </div>
            </div>

            <div
              ref={previewViewportRef}
              className={`${styles.checker} ${styles.previewViewport} relative touch-none select-none overflow-hidden ${
                isPanning ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{ height: PREVIEW_VIEWPORT_HEIGHT }}
              onPointerDown={handlePreviewPanStart}
              onPointerMove={handlePreviewPanMove}
              onPointerUp={stopPreviewPan}
              onPointerCancel={stopPreviewPan}
            >
              {previewBaseSize.width > 0 && (
                <div
                  className={styles.previewStage}
                  style={{
                    width: `${previewBaseSize.width * previewTransform.scale}px`,
                    height: `${previewBaseSize.height * previewTransform.scale}px`,
                    transform: `translate3d(${previewTransform.offsetX}px, ${previewTransform.offsetY}px, 0)`,
                  }}
                >
                  <div
                    ref={previewRef}
                    className="relative h-full w-full overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
                    style={{ backgroundColor, imageRendering: "auto" }}
                  >
                    {layout.tiles.map((tile) => {
                      const photo = photoById.get(tile.imageId);
                      if (!photo) return null;

                      return (
                        <div
                          key={photo.id}
                          className="absolute overflow-hidden"
                          style={{
                            left: `${(tile.x / layout.width) * 100}%`,
                            top: `${(tile.y / layout.height) * 100}%`,
                            width: `${(tile.width / layout.width) * 100}%`,
                            height: `${(tile.height / layout.height) * 100}%`,
                            borderRadius: cornerRadius,
                            backgroundColor,
                          }}
                        >
                          <img
                            src={photo.url}
                            alt=""
                            className="block h-full w-full"
                            style={{ objectFit: fitMode }}
                            draggable={false}
                          />
                        </div>
                      );
                    })}

                    {renderVerticalHandles(layout, startHandleDrag)}
                    {renderHorizontalHandles(layout, startHandleDrag)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {hasPhotos && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-text-primary">
                Layout
              </h3>
              <button
                type="button"
                onClick={resetOptions}
                className="text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                Reset options
              </button>
            </div>
            <div className="space-y-4">
              <SegmentedControl
                label="Output ratio"
                value={ratioPreset}
                options={ratioOptions}
                onChange={(value) =>
                  setRatioPreset(value as CollageRatioPreset)
                }
              />

              <SegmentedControl
                label="Image fit"
                value={fitMode}
                options={[
                  { value: "cover", label: "Fill" },
                  { value: "contain", label: "Fit" },
                ]}
                onChange={(value) => setFitMode(value as ImageCollageFitMode)}
              />

              <SliderField
                label="Gap"
                value={gap}
                min={0}
                max={40}
                step={1}
                unit="px"
                onChange={setGap}
              />

              <SliderField
                label="Corners"
                value={cornerRadius}
                min={0}
                max={32}
                step={1}
                unit="px"
                onChange={setCornerRadius}
              />

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Background
                </span>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-border-card bg-bg-secondary p-1"
                />
              </label>
            </div>
          </div>
        )}

        {hasPhotos && (
          <div className="rounded-xl border border-border-card bg-bg-card p-5">
            <h3 className="font-display mb-4 text-sm font-semibold text-text-primary">
              Export
            </h3>
            <div className="space-y-4">
              <SegmentedControl
                label="Format"
                value={outputFormat}
                options={[
                  { value: "png", label: "PNG" },
                  { value: "jpeg", label: "JPG" },
                  { value: "webp", label: "WebP" },
                ]}
                onChange={(value) =>
                  setOutputFormat(value as ImageCollageOutputFormat)
                }
              />

              {outputFormat !== "png" && (
                <SliderField
                  label="Quality"
                  value={quality}
                  min={40}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={setQuality}
                />
              )}

              <button
                type="button"
                onClick={exportCollage}
                disabled={!layout || isExporting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-purple px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-purple/80 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
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
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {isExporting ? "Exporting..." : "Download Collage"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderVerticalHandles(
  layout: CollageLayout,
  onPointerDown: (e: PointerEvent<HTMLButtonElement>, drag: DragHandle) => void,
) {
  const rows = groupTilesByRow(layout);

  return rows.flatMap((rowTiles) =>
    rowTiles.slice(0, -1).map((tile) => (
      <button
        key={`v-${tile.row}-${tile.column}`}
        type="button"
        className="absolute z-10 -translate-x-1/2 cursor-col-resize rounded-full bg-white/70 opacity-0 shadow-lg ring-1 ring-black/15 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
        style={{
          left: `${((tile.x + tile.width) / layout.width) * 100}%`,
          top: `${(tile.y / layout.height) * 100}%`,
          width: 10,
          height: `${(tile.height / layout.height) * 100}%`,
        }}
        aria-label="Resize column"
        onPointerDown={(e) =>
          onPointerDown(e, {
            type: "vertical",
            row: tile.row,
            column: tile.column,
            startClientX: e.clientX,
            baseLayout: cloneLayout(layout),
          })
        }
      />
    )),
  );
}

function renderHorizontalHandles(
  layout: CollageLayout,
  onPointerDown: (e: PointerEvent<HTMLButtonElement>, drag: DragHandle) => void,
) {
  const rows = groupTilesByRow(layout);

  return rows.slice(0, -1).map((rowTiles) => {
    const firstTile = rowTiles[0];
    return (
      <button
        key={`h-${firstTile.row}`}
        type="button"
        className="absolute left-0 z-10 -translate-y-1/2 cursor-row-resize rounded-full bg-white/70 opacity-0 shadow-lg ring-1 ring-black/15 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
        style={{
          top: `${((firstTile.y + firstTile.height) / layout.height) * 100}%`,
          width: "100%",
          height: 10,
        }}
        aria-label="Resize row"
        onPointerDown={(e) =>
          onPointerDown(e, {
            type: "horizontal",
            row: firstTile.row,
            startClientY: e.clientY,
            baseLayout: cloneLayout(layout),
          })
        }
      />
    );
  });
}

function resizeVerticalDivider(
  layout: CollageLayout,
  row: number,
  column: number,
  delta: number,
) {
  const nextLayout = cloneLayout(layout);
  const left = nextLayout.tiles.find(
    (tile) => tile.row === row && tile.column === column,
  );
  const right = nextLayout.tiles.find(
    (tile) => tile.row === row && tile.column === column + 1,
  );

  if (!left || !right) return nextLayout;

  const minDelta = MIN_TILE_SIZE - left.width;
  const maxDelta = right.width - MIN_TILE_SIZE;
  const safeDelta = Math.min(maxDelta, Math.max(minDelta, delta));
  left.width += safeDelta;
  right.x += safeDelta;
  right.width -= safeDelta;

  return nextLayout;
}

function resizeHorizontalDivider(
  layout: CollageLayout,
  row: number,
  delta: number,
) {
  const nextLayout = cloneLayout(layout);
  const topTiles = nextLayout.tiles.filter((tile) => tile.row === row);
  const bottomTiles = nextLayout.tiles.filter((tile) => tile.row === row + 1);
  if (!topTiles.length || !bottomTiles.length) return nextLayout;

  const topHeight = topTiles[0].height;
  const bottomHeight = bottomTiles[0].height;
  const minDelta = MIN_TILE_SIZE - topHeight;
  const maxDelta = bottomHeight - MIN_TILE_SIZE;
  const safeDelta = Math.min(maxDelta, Math.max(minDelta, delta));

  topTiles.forEach((tile) => {
    tile.height += safeDelta;
  });
  bottomTiles.forEach((tile) => {
    tile.y += safeDelta;
    tile.height -= safeDelta;
  });

  return nextLayout;
}

function groupTilesByRow(layout: CollageLayout) {
  const rows = new Map<number, CollageLayout["tiles"]>();

  layout.tiles.forEach((tile) => {
    const row = rows.get(tile.row) ?? [];
    row.push(tile);
    rows.set(tile.row, row);
  });

  return [...rows.values()].map((row) =>
    row.sort((a, b) => a.column - b.column),
  );
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tile: CollageLayout["tiles"][number],
  options: {
    fitMode: ImageCollageFitMode;
    cornerRadius: number;
    backgroundColor: string;
  },
) {
  const x = Math.round(tile.x);
  const y = Math.round(tile.y);
  const width = Math.round(tile.width);
  const height = Math.round(tile.height);
  const radius = Math.min(options.cornerRadius, width / 2, height / 2);

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(x, y, width, height);

  const scale =
    options.fitMode === "cover"
      ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
      : Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not draw one of the images."));
    image.src = src;
  });
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-card bg-bg-secondary text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        {children}
      </svg>
    </button>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-text-secondary">{label}</p>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-card bg-bg-secondary p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              value === option.value
                ? "bg-accent-purple/20 text-accent-purple"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-text-secondary">
        <span>{label}</span>
        <span className="font-mono text-text-muted">
          {value}
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
        className={`${styles.range} w-full`}
      />
    </div>
  );
}
