import { faker } from "@faker-js/faker";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES,
  loadParagraphGeneratorPreferences,
  saveParagraphGeneratorPreferences,
  type ParagraphGeneratorPreferences,
  type ParagraphSource,
  type ParagraphTone,
} from "./preferences";

const LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum",
];

const SOURCE_OPTIONS: Array<{ value: ParagraphSource; label: string }> = [
  { value: "lorem", label: "Lorem ipsum" },
  { value: "faker", label: "Real paragraphs" },
];

const TONE_OPTIONS: Array<{ value: ParagraphTone; label: string }> = [
  { value: "business", label: "Business" },
  { value: "product", label: "Product" },
  { value: "technical", label: "Technical" },
  { value: "everyday", label: "Everyday" },
];

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(items: T[], random: () => number) {
  return items[randomInteger(random, 0, items.length - 1)];
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function generateLoremSentence(random: () => number) {
  const wordCount = randomInteger(random, 8, 18);
  const words = Array.from({ length: wordCount }, () =>
    pick(LOREM_WORDS, random),
  );
  return `${capitalize(words.join(" "))}.`;
}

function generateLoremParagraphs(preferences: ParagraphGeneratorPreferences) {
  const random = preferences.useSeed
    ? createSeededRandom(preferences.seed)
    : Math.random;

  return Array.from({ length: preferences.paragraphCount }, (_, index) => {
    const sentences = Array.from(
      { length: preferences.sentencesPerParagraph },
      () => generateLoremSentence(random),
    ).join(" ");

    if (!preferences.includeHeadings) return sentences;
    return `Section ${index + 1}\n${sentences}`;
  });
}

function generateRealHeading(tone: ParagraphTone) {
  switch (tone) {
    case "business":
      return `${faker.company.name()} update`;
    case "product":
      return `${faker.commerce.productName()} brief`;
    case "technical":
      return `${faker.hacker.adjective()} ${faker.hacker.noun()} notes`;
    case "everyday":
      return `${faker.location.city()} notes`;
  }
}

function generateRealSentence(tone: ParagraphTone) {
  switch (tone) {
    case "business":
      return `${faker.person.jobTitle()}s at ${faker.company.name()} are reviewing ${faker.company.catchPhrase().toLowerCase()} while planning the next ${faker.commerce.department().toLowerCase()} milestone.`;
    case "product":
      return `The ${faker.commerce.productName()} gives teams a ${faker.commerce.productAdjective().toLowerCase()} way to manage ${faker.commerce.department().toLowerCase()} work without slowing down daily decisions.`;
    case "technical":
      return `${capitalize(faker.hacker.phrase())} The team is validating ${faker.system.commonFileName()} against a ${faker.hacker.adjective()} ${faker.hacker.noun()} before release.`;
    case "everyday":
      return `${faker.person.fullName()} met with a ${faker.person.jobTitle().toLowerCase()} in ${faker.location.city()} to talk through a practical plan for ${faker.commerce.product().toLowerCase()} improvements.`;
  }
}

function generateRealParagraphs(preferences: ParagraphGeneratorPreferences) {
  if (preferences.useSeed) {
    faker.seed(preferences.seed);
  }

  return Array.from({ length: preferences.paragraphCount }, () => {
    const sentences = Array.from(
      { length: preferences.sentencesPerParagraph },
      () => generateRealSentence(preferences.tone),
    ).join(" ");

    if (!preferences.includeHeadings) return sentences;
    return `${generateRealHeading(preferences.tone)}\n${sentences}`;
  });
}

function generateParagraphs(preferences: ParagraphGeneratorPreferences) {
  const paragraphs =
    preferences.source === "lorem"
      ? generateLoremParagraphs(preferences)
      : generateRealParagraphs(preferences);
  return paragraphs.join(
    preferences.separator === "blank-line" ? "\n\n" : "\n",
  );
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export default function ParagraphGeneratorApp() {
  const savedPreferences = useMemo(loadParagraphGeneratorPreferences, []);
  const [preferences, setPreferences] = useState(savedPreferences);
  const [output, setOutput] = useState(() =>
    generateParagraphs(savedPreferences),
  );
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(() => countWords(output), [output]);
  const characterCount = output.length;

  useEffect(() => {
    saveParagraphGeneratorPreferences(preferences);
  }, [preferences]);

  function updatePreferences(
    updater: (
      previous: ParagraphGeneratorPreferences,
    ) => ParagraphGeneratorPreferences,
  ) {
    setPreferences((previous) => {
      const next = updater(previous);
      setOutput(generateParagraphs(next));
      setCopied(false);
      return next;
    });
  }

  function updatePreference<K extends keyof ParagraphGeneratorPreferences>(
    key: K,
    value: ParagraphGeneratorPreferences[K],
  ) {
    updatePreferences((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function generate() {
    setOutput(generateParagraphs(preferences));
    setCopied(false);
  }

  function resetToDefaults() {
    setPreferences(DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES);
    setOutput(generateParagraphs(DEFAULT_PARAGRAPH_GENERATOR_PREFERENCES));
    setCopied(false);
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadOutput() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "paragraphs.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border-card bg-bg-card/80 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-cyan">
              Configuration
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
              Paragraph settings
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

        <div className="mt-5 space-y-5">
          <SegmentedControl
            label="Source"
            options={SOURCE_OPTIONS}
            value={preferences.source}
            onChange={(value) => updatePreference("source", value)}
          />

          <SegmentedControl
            disabled={preferences.source === "lorem"}
            label="Tone"
            options={TONE_OPTIONS}
            value={preferences.tone}
            onChange={(value) => updatePreference("tone", value)}
          />

          <NumberSlider
            label="Paragraphs"
            max={12}
            min={1}
            onChange={(value) => updatePreference("paragraphCount", value)}
            value={preferences.paragraphCount}
          />

          <NumberSlider
            label="Sentences each"
            max={8}
            min={2}
            onChange={(value) =>
              updatePreference("sentencesPerParagraph", value)
            }
            value={preferences.sentencesPerParagraph}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              Separator
            </label>
            <select
              value={preferences.separator}
              onChange={(event) =>
                updatePreference(
                  "separator",
                  event.target
                    .value as ParagraphGeneratorPreferences["separator"],
                )
              }
              className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
            >
              <option value="blank-line">Blank line</option>
              <option value="line-break">Single line break</option>
            </select>
          </div>

          <ToggleRow
            checked={preferences.includeHeadings}
            label="Include headings"
            onChange={(checked) => updatePreference("includeHeadings", checked)}
          />

          <ToggleRow
            checked={preferences.useSeed}
            label="Use repeatable seed"
            onChange={(checked) => updatePreference("useSeed", checked)}
          />

          {preferences.useSeed && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-text-secondary">
                Seed
              </span>
              <input
                type="number"
                min={1}
                max={999999}
                value={preferences.seed}
                onChange={(event) =>
                  updatePreference("seed", Number(event.target.value))
                }
                className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
              />
            </label>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-border-card bg-bg-card/80 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-cyan">
              Output
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-text-primary">
              Generated copy
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {wordCount} words · {characterCount} characters
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-4 py-2 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/15"
            >
              <RefreshIcon />
              Generate
            </button>
            <button
              type="button"
              onClick={copyOutput}
              className="inline-flex items-center gap-2 rounded-full border border-border-card bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={downloadOutput}
              className="inline-flex items-center gap-2 rounded-full border border-border-card bg-bg-secondary px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-card-hover hover:text-text-primary"
            >
              <DownloadIcon />
              Download
            </button>
          </div>
        </div>

        <textarea
          value={output}
          onChange={(event) => setOutput(event.target.value)}
          spellCheck={false}
          className="mt-5 min-h-[28rem] w-full resize-y rounded-xl border border-border-card bg-bg-secondary/70 p-4 font-mono text-sm leading-7 text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
        />
      </section>
    </div>
  );
}

function SegmentedControl<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
}) {
  return (
    <div className={disabled ? "opacity-45" : ""}>
      <label className="mb-2 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none ${
              value === option.value
                ? "border-accent-cyan/35 bg-accent-cyan/10 text-accent-cyan"
                : "border-border-card bg-bg-secondary text-text-secondary hover:border-border-card-hover hover:text-text-primary"
            }`}
          >
            {option.label}
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
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
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
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-[var(--color-accent-cyan)]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
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
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        checked
          ? "border-accent-cyan/35 bg-accent-cyan/10 text-accent-cyan"
          : "border-border-card bg-bg-secondary/60 text-text-secondary hover:border-border-card-hover hover:text-text-primary"
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

function RefreshIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992m0 0V4.356m0 4.992-3.18-3.18a8.25 8.25 0 0 0-13.803 3.7M7.977 14.652H2.985m0 0v4.992m0-4.992 3.18 3.18a8.25 8.25 0 0 0 13.803-3.7"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H8.25m7.5 10.5h3.375c.621 0 1.125-.504 1.125-1.125v-9.75c0-.621-.504-1.125-1.125-1.125H10.875c-.621 0-1.125.504-1.125 1.125v3.375"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0 4.5-4.5M12 16.5V3"
      />
    </svg>
  );
}
