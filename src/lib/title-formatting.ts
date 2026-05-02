export const TITLE_FORMAT_MODES = [
  "title",
  "sentence",
  "uppercase",
  "lowercase",
  "first-letter",
  "alt",
  "toggle",
] as const;

export type TitleFormatMode = (typeof TITLE_FORMAT_MODES)[number];

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;
const LETTER_PATTERN = /\p{L}/u;

const SMALL_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "vs",
  "via",
  "with",
]);

function isLetter(character: string) {
  return LETTER_PATTERN.test(character);
}

function capitalizeWord(word: string) {
  return word
    .split("-")
    .map((part) => {
      const lower = part.toLocaleLowerCase();
      const letters = Array.from(lower);
      const index = letters.findIndex(isLetter);
      if (index === -1) return lower;
      letters[index] = letters[index].toLocaleUpperCase();
      return letters.join("");
    })
    .join("-");
}

function titleCaseLine(line: string) {
  const words = Array.from(line.matchAll(WORD_PATTERN));
  const lastIndex = words.length - 1;
  let wordIndex = 0;

  return line.replace(WORD_PATTERN, (word) => {
    const lower = word.toLocaleLowerCase();
    const isSmallWord = SMALL_TITLE_WORDS.has(lower);
    const formatted =
      wordIndex > 0 && wordIndex < lastIndex && isSmallWord
        ? lower
        : capitalizeWord(word);
    wordIndex += 1;
    return formatted;
  });
}

function toTitleCase(input: string) {
  return input.split("\n").map(titleCaseLine).join("\n");
}

function toSentenceCase(input: string) {
  const lower = input.toLocaleLowerCase();
  return lower.replace(/(^|[\n.!?]\s*)(\p{L})/gu, (_, prefix, letter) => {
    return `${prefix}${letter.toLocaleUpperCase()}`;
  });
}

function toFirstLetterCase(input: string) {
  return input.toLocaleLowerCase().replace(WORD_PATTERN, capitalizeWord);
}

function toAlternatingCase(input: string, startsUppercase: boolean) {
  let uppercaseNext = startsUppercase;

  return Array.from(input)
    .map((character) => {
      if (!isLetter(character)) return character;
      const next = uppercaseNext
        ? character.toLocaleUpperCase()
        : character.toLocaleLowerCase();
      uppercaseNext = !uppercaseNext;
      return next;
    })
    .join("");
}

function toToggleCase(input: string) {
  return toAlternatingCase(input, false);
}

export function formatTitle(input: string, mode: TitleFormatMode) {
  switch (mode) {
    case "title":
      return toTitleCase(input);
    case "sentence":
      return toSentenceCase(input);
    case "uppercase":
      return input.toLocaleUpperCase();
    case "lowercase":
      return input.toLocaleLowerCase();
    case "first-letter":
      return toFirstLetterCase(input);
    case "alt":
      return toAlternatingCase(input, true);
    case "toggle":
      return toToggleCase(input);
  }
}
