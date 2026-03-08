import { useState, useCallback } from "react";

type SlashDirection = "forward" | "backward";

function convert(input: string, direction: SlashDirection): string {
  if (direction === "forward") return input.replace(/\\/g, "/");
  return input.replace(/\//g, "\\");
}

function detect(input: string): SlashDirection | null {
  const hasBack = input.includes("\\");
  const hasFwd = input.includes("/");
  if (hasBack && !hasFwd) return "backward";
  if (hasFwd && !hasBack) return "forward";
  return null;
}

export default function PathConverterApp() {
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<SlashDirection>("forward");
  const [copied, setCopied] = useState(false);

  const output = convert(input, direction);
  const detected = detect(input);

  const handleInput = useCallback(
    (val: string) => {
      setInput(val);
      setCopied(false);
      // Auto-detect and set the opposite direction
      const det = detect(val);
      if (det === "backward") setDirection("forward");
      else if (det === "forward") setDirection("backward");
    },
    [],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const handleSwap = useCallback(() => {
    setInput(output);
    setDirection((d) => (d === "forward" ? "backward" : "forward"));
    setCopied(false);
  }, [output]);

  return (
    <div className="space-y-6">
      {/* Direction toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">Convert to:</span>
        <div className="inline-flex rounded-lg border border-border-card bg-bg-secondary p-0.5">
          <button
            onClick={() => setDirection("forward")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              direction === "forward"
                ? "bg-accent-teal/15 text-accent-teal border border-accent-teal/25"
                : "text-text-muted hover:text-text-secondary border border-transparent"
            }`}
          >
            Forward slash <code className="ml-1 text-xs opacity-75">/</code>
          </button>
          <button
            onClick={() => setDirection("backward")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              direction === "backward"
                ? "bg-accent-teal/15 text-accent-teal border border-accent-teal/25"
                : "text-text-muted hover:text-text-secondary border border-transparent"
            }`}
          >
            Backslash <code className="ml-1 text-xs opacity-75">\</code>
          </button>
        </div>
      </div>

      {/* Input */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
          Input path
          {detected && (
            <span className="ml-2 text-text-muted font-normal">
              (detected: {detected === "forward" ? "/" : "\\"} slashes)
            </span>
          )}
        </label>
        <textarea
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="C:\Users\me\project\src\index.ts"
          rows={3}
          className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:outline-none focus:ring-1 focus:ring-accent-teal/20 transition-colors resize-y"
          spellCheck={false}
        />
      </div>

      {/* Output */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Output</label>
          <div className="flex gap-2">
            <button
              onClick={handleSwap}
              disabled={!input}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary hover:bg-bg-secondary disabled:opacity-40 disabled:pointer-events-none"
              title="Swap input and output"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Swap
            </button>
            <button
              onClick={handleCopy}
              disabled={!output}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-teal hover:bg-accent-teal/10 disabled:opacity-40 disabled:pointer-events-none"
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <div className="w-full rounded-lg border border-border-card bg-bg-card/60 px-3 py-2.5 font-mono text-sm text-text-primary min-h-[4.5rem] whitespace-pre-wrap break-all">
          {output || <span className="text-text-muted/50">Converted path will appear here...</span>}
        </div>
      </div>
    </div>
  );
}
