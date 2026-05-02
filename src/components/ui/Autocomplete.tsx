import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface AutocompleteOption {
  id: string;
  label: string;
  description?: string;
}

interface AutocompleteProps {
  id: string;
  label: string;
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export default function Autocomplete({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "No matches found",
}: AutocompleteProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressFocusOpenRef = useRef(false);
  const listboxId = `${id}-listbox`;
  const selectedOption = options.find((option) => option.id === value);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label ?? "");
    }
  }, [isOpen, selectedOption?.label]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => {
      const haystack =
        `${option.label} ${option.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  function openList() {
    setIsOpen(true);
    setActiveIndex(0);
  }

  function focusInput(openOnFocus = true) {
    suppressFocusOpenRef.current = !openOnFocus;
    inputRef.current?.focus({ preventScroll: true });

    if (!openOnFocus) {
      window.setTimeout(() => {
        suppressFocusOpenRef.current = false;
      }, 0);
    }
  }

  function closeList() {
    setIsOpen(false);
    setQuery(selectedOption?.label ?? "");
  }

  function chooseOption(option: AutocompleteOption) {
    onChange(option.id);
    setQuery(option.label);
    setIsOpen(false);
    focusInput(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openList();
        return;
      }

      setActiveIndex((index) =>
        Math.min(index + 1, filteredOptions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) chooseOption(option);
    } else if (event.key === "Escape") {
      closeList();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-text-secondary"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={
            isOpen && filteredOptions[activeIndex]
              ? `${id}-option-${filteredOptions[activeIndex].id}`
              : undefined
          }
          value={isOpen ? query : (selectedOption?.label ?? query)}
          onChange={(event) => {
            setQuery(event.target.value);
            openList();
          }}
          onFocus={() => {
            if (suppressFocusOpenRef.current) return;
            openList();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border-card bg-bg-secondary px-3 py-2.5 pr-10 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent-teal/40 focus:ring-1 focus:ring-accent-teal/20"
        />
        <button
          type="button"
          aria-label={isOpen ? "Close model list" : "Open model list"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (isOpen) {
              closeList();
              focusInput(false);
              return;
            }

            openList();
            focusInput();
          }}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-card hover:text-text-secondary"
        >
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 9l6 6 6-6"
            />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border-card bg-bg-card p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                key={option.id}
                id={`${id}-option-${option.id}`}
                type="button"
                role="option"
                aria-selected={option.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseOption(option)}
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  index === activeIndex
                    ? "bg-bg-card-hover text-text-primary"
                    : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                }`}
              >
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {option.description}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm text-text-muted">
              {emptyLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
