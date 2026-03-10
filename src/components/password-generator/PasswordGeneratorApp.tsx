import { useState, useCallback, useMemo } from "react";

interface Options {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

function generatePassword(opts: Options): string {
  let pool = "";
  if (opts.uppercase) pool += CHARSETS.uppercase;
  if (opts.lowercase) pool += CHARSETS.lowercase;
  if (opts.numbers) pool += CHARSETS.numbers;
  if (opts.symbols) pool += CHARSETS.symbols;
  if (!pool) return "";

  const arr = new Uint32Array(opts.length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => pool[v % pool.length]).join("");
}

type Strength = "weak" | "medium" | "strong" | "very-strong";

function evaluateStrength(opts: Options): { strength: Strength; label: string } {
  const pools = [opts.uppercase, opts.lowercase, opts.numbers, opts.symbols].filter(Boolean).length;
  if (pools === 0) return { strength: "weak", label: "No characters selected" };

  // Rough entropy: log2(poolSize) * length
  let poolSize = 0;
  if (opts.uppercase) poolSize += 26;
  if (opts.lowercase) poolSize += 26;
  if (opts.numbers) poolSize += 10;
  if (opts.symbols) poolSize += 26;

  const entropy = Math.log2(poolSize) * opts.length;

  if (entropy < 36) return { strength: "weak", label: "Weak" };
  if (entropy < 60) return { strength: "medium", label: "Medium" };
  if (entropy < 80) return { strength: "strong", label: "Strong" };
  return { strength: "very-strong", label: "Very Strong" };
}

const strengthColors: Record<Strength, { bar: string; text: string }> = {
  weak: { bar: "bg-red-500", text: "text-red-400" },
  medium: { bar: "bg-yellow-500", text: "text-yellow-400" },
  strong: { bar: "bg-green-500", text: "text-green-400" },
  "very-strong": { bar: "bg-emerald-400", text: "text-emerald-400" },
};

const strengthWidth: Record<Strength, string> = {
  weak: "w-1/4",
  medium: "w-2/4",
  strong: "w-3/4",
  "very-strong": "w-full",
};

export default function PasswordGeneratorApp() {
  const [options, setOptions] = useState<Options>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: false,
  });
  const [password, setPassword] = useState(() => generatePassword({
    length: 16, uppercase: true, lowercase: true, numbers: true, symbols: false,
  }));
  const [copied, setCopied] = useState(false);

  const { strength, label } = useMemo(() => evaluateStrength(options), [options]);
  const colors = strengthColors[strength];

  const generate = useCallback(() => {
    const pw = generatePassword(options);
    setPassword(pw);
    setCopied(false);
  }, [options]);

  const updateOption = useCallback(<K extends keyof Options>(key: K, value: Options[K]) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      // Ensure at least one charset is selected
      if (key !== "length") {
        const anySelected = next.uppercase || next.lowercase || next.numbers || next.symbols;
        if (!anySelected) return prev;
      }
      setPassword(generatePassword(next));
      setCopied(false);
      return next;
    });
  }, []);

  const handleCopy = useCallback(() => {
    if (!password) return;
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [password]);

  return (
    <div className="space-y-6">
      {/* Generated password display */}
      <div className="rounded-xl border border-border-card bg-bg-card/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Generated Password</label>
          <div className="flex gap-2">
            <button
              onClick={generate}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-indigo hover:bg-accent-indigo/10"
              title="Regenerate"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Regenerate
            </button>
            <button
              onClick={handleCopy}
              disabled={!password}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent-indigo hover:bg-accent-indigo/10 disabled:opacity-40 disabled:pointer-events-none"
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
        <div className="w-full rounded-lg border border-border-card bg-bg-secondary px-4 py-3 font-mono text-base text-text-primary break-all select-all min-h-[2.75rem]">
          {password || <span className="text-text-muted/50">Select at least one character type</span>}
        </div>

        {/* Strength indicator */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${colors.bar} ${strengthWidth[strength]}`} />
          </div>
          <span className={`text-xs font-medium ${colors.text} min-w-[5rem] text-right`}>{label}</span>
        </div>
      </div>

      {/* Options */}
      <div className="rounded-xl border border-border-card bg-bg-card/60 p-4 space-y-5">
        {/* Length slider */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Password Length</label>
            <span className="rounded-md border border-border-card bg-bg-secondary px-2.5 py-0.5 font-mono text-sm text-text-primary">
              {options.length}
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={128}
            value={options.length}
            onChange={(e) => updateOption("length", Number(e.target.value))}
            className="w-full accent-[var(--color-accent-indigo)] cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-text-muted">
            <span>4</span>
            <span>32</span>
            <span>64</span>
            <span>96</span>
            <span>128</span>
          </div>
        </div>

        {/* Character type toggles */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">Character Types</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "uppercase" as const, label: "Uppercase", hint: "A–Z" },
              { key: "lowercase" as const, label: "Lowercase", hint: "a–z" },
              { key: "numbers" as const, label: "Numbers", hint: "0–9" },
              { key: "symbols" as const, label: "Symbols", hint: "!@#$%..." },
            ]).map(({ key, label, hint }) => (
              <button
                key={key}
                onClick={() => updateOption(key, !options[key])}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  options[key]
                    ? "bg-accent-indigo/10 border-accent-indigo/25 text-accent-indigo"
                    : "border-border-card text-text-muted hover:text-text-secondary hover:border-border-card-hover"
                }`}
              >
                <span>{label}</span>
                <code className="text-xs opacity-70">{hint}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
