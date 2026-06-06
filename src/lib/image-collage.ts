export type CollageRatioPreset =
  | "auto"
  | "square"
  | "portrait"
  | "landscape"
  | "photo";

export interface CollageImageInput {
  id: string;
  width: number;
  height: number;
}

export interface CollageLayoutOptions {
  ratioPreset: CollageRatioPreset;
  gap: number;
  maxPixels?: number;
  maxLongEdge?: number;
}

export interface CollageTile {
  imageId: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageLayout {
  width: number;
  height: number;
  ratio: number;
  score: number;
  rows: number[][];
  tiles: CollageTile[];
}

interface ScoredRows {
  rows: number[][];
  score: number;
}

const RATIO_PRESETS: Record<Exclude<CollageRatioPreset, "auto">, number> = {
  square: 1,
  portrait: 4 / 5,
  landscape: 16 / 9,
  photo: 3 / 2,
};

const AUTO_RATIOS = [1, 4 / 5, 5 / 4, 16 / 9, 9 / 16, 3 / 2, 2 / 3];
const DEFAULT_MAX_PIXELS = 12_000_000;
const DEFAULT_MAX_LONG_EDGE = 4096;

export function getCollageRatioValue(
  preset: CollageRatioPreset,
): number | null {
  if (preset === "auto") return null;
  return RATIO_PRESETS[preset];
}

export function createCollageLayout(
  images: CollageImageInput[],
  options: CollageLayoutOptions,
): CollageLayout {
  const usableImages = images.filter(
    (image) => image.width > 0 && image.height > 0,
  );

  if (!usableImages.length) {
    return { width: 0, height: 0, ratio: 1, score: 0, rows: [], tiles: [] };
  }

  const ratios = usableImages.map((image) =>
    clamp(image.width / image.height, 0.08, 12),
  );
  const candidateRatios =
    options.ratioPreset === "auto"
      ? buildAutoRatioCandidates(ratios)
      : [RATIO_PRESETS[options.ratioPreset]];

  let bestLayout: CollageLayout | null = null;

  for (const candidateRatio of candidateRatios) {
    const rows = findBestRows(ratios, candidateRatio);
    const dimensions = chooseCanvasDimensions(
      usableImages,
      candidateRatio,
      options.maxPixels ?? DEFAULT_MAX_PIXELS,
      options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE,
    );
    const layout = buildLayout(
      usableImages,
      ratios,
      rows,
      dimensions.width,
      dimensions.height,
      Math.max(0, options.gap),
    );

    if (!bestLayout || layout.score < bestLayout.score) {
      bestLayout = layout;
    }
  }

  return bestLayout!;
}

function buildAutoRatioCandidates(ratios: number[]) {
  const averageRatio =
    ratios.reduce((total, ratio) => total + ratio, 0) /
    Math.max(1, ratios.length);
  const weightedRatio = Math.sqrt(
    ratios.reduce((total, ratio) => total + ratio * ratio, 0) /
      Math.max(1, ratios.length),
  );

  return uniqueNumbers(
    [...AUTO_RATIOS, averageRatio, weightedRatio].map((ratio) =>
      clamp(ratio, 0.5, 2.25),
    ),
  );
}

function findBestRows(ratios: number[], targetRatio: number): ScoredRows {
  const count = ratios.length;
  const targetHeight = 1 / targetRatio;
  const maxRows = Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count)) + 3));
  let best: ScoredRows | null = null;

  for (let rowCount = 1; rowCount <= maxRows; rowCount += 1) {
    const targetRowHeight = targetHeight / rowCount;
    const costs = Array.from({ length: count + 1 }, () =>
      Array(rowCount + 1).fill(Number.POSITIVE_INFINITY),
    );
    const previous = Array.from({ length: count + 1 }, () =>
      Array(rowCount + 1).fill(-1),
    );

    costs[0][0] = 0;

    for (let used = 1; used <= count; used += 1) {
      for (let rows = 1; rows <= Math.min(rowCount, used); rows += 1) {
        for (let start = rows - 1; start < used; start += 1) {
          if (!Number.isFinite(costs[start][rows - 1])) continue;

          const rowRatios = ratios.slice(start, used);
          const ratioSum = sum(rowRatios);
          const rowHeight = 1 / ratioSum;
          const heightError =
            Math.abs(rowHeight - targetRowHeight) / targetRowHeight;
          const lonelyPenalty = rowRatios.length === 1 && count > 2 ? 0.05 : 0;
          const cost =
            costs[start][rows - 1] + heightError * heightError + lonelyPenalty;

          if (cost < costs[used][rows]) {
            costs[used][rows] = cost;
            previous[used][rows] = start;
          }
        }
      }
    }

    if (!Number.isFinite(costs[count][rowCount])) continue;

    const rows = reconstructRows(previous, count, rowCount);
    const score = scoreRows(rows, ratios, targetRatio);

    if (!best || score < best.score) {
      best = { rows, score };
    }
  }

  return best ?? { rows: [ratios.map((_, index) => index)], score: 0 };
}

function reconstructRows(
  previous: number[][],
  count: number,
  rowCount: number,
) {
  const rows: number[][] = [];
  let used = count;

  for (let row = rowCount; row >= 1; row -= 1) {
    const start = previous[used][row];
    rows.unshift(range(start, used));
    used = start;
  }

  return rows;
}

function scoreRows(rows: number[][], ratios: number[], targetRatio: number) {
  const naturalHeights = rows.map((row) => 1 / sum(row.map((i) => ratios[i])));
  const naturalHeight = sum(naturalHeights);
  const ratioError = Math.abs(1 / naturalHeight - targetRatio) / targetRatio;
  const averageHeight = naturalHeight / rows.length;
  const balanceError =
    naturalHeights.reduce(
      (total, height) =>
        total + Math.abs(height - averageHeight) / averageHeight,
      0,
    ) / rows.length;
  const singleItemRows = rows.filter((row) => row.length === 1).length;

  return ratioError * 5 + balanceError + singleItemRows * 0.03;
}

function chooseCanvasDimensions(
  images: CollageImageInput[],
  ratio: number,
  maxPixels: number,
  maxLongEdge: number,
) {
  const sourcePixels = images.reduce(
    (total, image) => total + image.width * image.height,
    0,
  );
  const area = clamp(sourcePixels, 1, maxPixels);
  let width = Math.sqrt(area * ratio);
  let height = width / ratio;
  const longEdge = Math.max(width, height);

  if (longEdge > maxLongEdge) {
    const scale = maxLongEdge / longEdge;
    width *= scale;
    height *= scale;
  }

  return {
    width: Math.max(320, roundEven(width)),
    height: Math.max(320, roundEven(height)),
  };
}

function buildLayout(
  images: CollageImageInput[],
  ratios: number[],
  scoredRows: ScoredRows,
  canvasWidth: number,
  canvasHeight: number,
  gap: number,
): CollageLayout {
  const maxColumns = Math.max(...scoredRows.rows.map((row) => row.length));
  const effectiveGap = Math.min(
    gap,
    canvasWidth / Math.max(1, maxColumns * 3),
    canvasHeight / Math.max(1, scoredRows.rows.length * 3),
  );
  const availableHeight =
    canvasHeight - Math.max(0, scoredRows.rows.length - 1) * effectiveGap;
  const naturalHeights = scoredRows.rows.map((row) => {
    const rowGap = Math.max(0, row.length - 1) * effectiveGap;
    return (canvasWidth - rowGap) / sum(row.map((index) => ratios[index]));
  });
  const naturalTotalHeight = sum(naturalHeights);
  const scaledHeights = naturalHeights.map(
    (height) => (height / naturalTotalHeight) * availableHeight,
  );

  const tiles: CollageTile[] = [];
  let y = 0;
  let cropPressure = 0;

  scoredRows.rows.forEach((row, rowIndex) => {
    const rowGap = Math.max(0, row.length - 1) * effectiveGap;
    const availableWidth = canvasWidth - rowGap;
    const ratioSum = sum(row.map((index) => ratios[index]));
    const rowHeight = scaledHeights[rowIndex];
    let x = 0;

    row.forEach((imageIndex, columnIndex) => {
      const width =
        columnIndex === row.length - 1
          ? canvasWidth - x
          : (availableWidth * ratios[imageIndex]) / ratioSum;
      const height = rowHeight;
      const tileRatio = width / height;
      const imageRatio = ratios[imageIndex];

      cropPressure += Math.abs(Math.log(tileRatio / imageRatio));
      tiles.push({
        imageId: images[imageIndex].id,
        row: rowIndex,
        column: columnIndex,
        x,
        y,
        width,
        height,
      });
      x += width + effectiveGap;
    });

    y += rowHeight + effectiveGap;
  });

  return {
    width: canvasWidth,
    height: canvasHeight,
    ratio: canvasWidth / canvasHeight,
    score: scoredRows.score + cropPressure / images.length,
    rows: scoredRows.rows,
    tiles,
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function range(start: number, end: number) {
  return Array.from({ length: end - start }, (_, offset) => start + offset);
}

function uniqueNumbers(values: number[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toFixed(3);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundEven(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}
