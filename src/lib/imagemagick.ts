// Thin wrapper around wasm-imagemagick's web worker API.
// Expects magick.js + magick.wasm to live at /magick/ (served from public/).

export interface ConvertOptions {
  quality?: number;
  resize?: string; // e.g. "800x600", "50%"
  strip?: boolean; // strip metadata
}

export interface ConvertedFile {
  name: string;
  blob: Blob;
  buffer: ArrayBuffer;
}

interface WorkerRequest {
  files: { name: string; content: Uint8Array }[];
  args: string[];
  requestNumber: number;
}

interface WorkerResponse {
  requestNumber: number;
  outputFiles: { name: string; buffer: Uint8Array | ArrayBuffer; blob?: Blob }[];
  stdout: string[];
  stderr: string[];
  exitCode: number | undefined;
}

let worker: Worker | null = null;
let requestId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

function getWorker(): Worker {
  if (worker) return worker;

  const magickJsUrl = new URL("/magick/magick.js", window.location.origin).href;
  const workerBlob = new Blob(
    [`var magickJsCurrentPath = '${magickJsUrl}';\nimportScripts(magickJsCurrentPath);`],
    { type: "application/javascript" }
  );
  worker = new Worker(URL.createObjectURL(workerBlob));

  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const { requestNumber, outputFiles, stdout, stderr, exitCode } = e.data;
    const p = pending.get(requestNumber);
    if (!p) return;
    pending.delete(requestNumber);
    p.resolve({ outputFiles, stdout, stderr, exitCode });
  };

  worker.onerror = (e) => {
    // Reject all pending on fatal worker error
    for (const [id, p] of pending) {
      p.reject(new Error(`Worker error: ${e.message}`));
      pending.delete(id);
    }
  };

  return worker;
}

async function callMagick(
  inputFiles: { name: string; content: Uint8Array }[],
  args: string[]
): Promise<WorkerResponse> {
  const w = getWorker();
  const id = requestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ files: inputFiles, args, requestNumber: id } satisfies WorkerRequest);
  });
}

function buildArgs(inputName: string, outputName: string, opts: ConvertOptions): string[] {
  const args = ["convert", inputName];
  if (opts.strip) args.push("-strip");
  if (opts.resize) args.push("-resize", opts.resize);
  if (opts.quality !== undefined) args.push("-quality", String(opts.quality));
  args.push(outputName);
  return args;
}

function changeExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.substring(0, dot) : filename;
  return `${base}.${newExt}`;
}

export async function convertImage(
  file: File,
  targetFormat: string,
  options: ConvertOptions = {}
): Promise<ConvertedFile> {
  const content = new Uint8Array(await file.arrayBuffer());
  const outputName = changeExtension(file.name, targetFormat);
  const args = buildArgs(file.name, outputName, options);

  const result = await callMagick([{ name: file.name, content }], args);

  if (result.exitCode) {
    throw new Error(result.stderr.join("\n") || `Conversion failed (exit code ${result.exitCode})`);
  }

  if (!result.outputFiles.length) {
    throw new Error("No output file produced");
  }

  const out = result.outputFiles[0];
  const buf = out.buffer instanceof ArrayBuffer ? out.buffer : out.buffer.buffer;
  return {
    name: out.name,
    blob: new Blob([out.buffer]),
    buffer: buf,
  };
}

export async function convertBatch(
  files: File[],
  targetFormat: string,
  options: ConvertOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<ConvertedFile[]> {
  const results: ConvertedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await convertImage(files[i], targetFormat, options);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }
  return results;
}

export const SUPPORTED_FORMATS = [
  { ext: "png", label: "PNG", mime: "image/png" },
  { ext: "jpg", label: "JPEG", mime: "image/jpeg" },
  { ext: "gif", label: "GIF", mime: "image/gif" },
  { ext: "bmp", label: "BMP", mime: "image/bmp" },
  { ext: "tiff", label: "TIFF", mime: "image/tiff" },
  { ext: "ico", label: "ICO", mime: "image/x-icon" },
  { ext: "tga", label: "TGA", mime: "image/x-tga" },
  { ext: "psd", label: "PSD", mime: "image/vnd.adobe.photoshop" },
  { ext: "ppm", label: "PPM", mime: "image/x-portable-pixmap" },
  { ext: "pgm", label: "PGM", mime: "image/x-portable-graymap" },
  { ext: "hdr", label: "HDR", mime: "image/vnd.radiance" },
  { ext: "pcx", label: "PCX", mime: "image/x-pcx" },
] as const;

export const ACCEPTED_INPUT_EXTENSIONS = SUPPORTED_FORMATS.map((f) => `.${f.ext}`).join(",");
