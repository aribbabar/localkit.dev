import { describe, expect, it } from "vitest";
import { formatTitle } from "../src/lib/title-formatting";

describe("title formatting", () => {
  it("formats title case with short connector words", () => {
    expect(formatTitle("a guide to working with local tools", "title")).toBe(
      "A Guide to Working with Local Tools",
    );
  });

  it("formats sentence case", () => {
    expect(
      formatTitle("BUILD LOCAL TOOLS. KEEP PRIVATE DATA LOCAL!", "sentence"),
    ).toBe("Build local tools. Keep private data local!");
    expect(formatTitle("FIRST LINE\nSECOND LINE", "sentence")).toBe(
      "First line\nSecond line",
    );
  });

  it("formats uppercase and lowercase", () => {
    expect(formatTitle("LocalKit Title", "uppercase")).toBe("LOCALKIT TITLE");
    expect(formatTitle("LocalKit Title", "lowercase")).toBe("localkit title");
  });

  it("capitalizes the first letter of each word", () => {
    expect(formatTitle("make every word start clean", "first-letter")).toBe(
      "Make Every Word Start Clean",
    );
  });

  it("formats alternating case", () => {
    expect(formatTitle("the quick brown fox", "alt")).toBe(
      "ThE qUiCk BrOwN fOx",
    );
  });

  it("formats toggle case", () => {
    expect(formatTitle("LocalKit TITLE 2026", "toggle")).toBe(
      "lOcAlKiT tItLe 2026",
    );
    expect(formatTitle("the quick brown fox", "toggle")).toBe(
      "tHe QuIcK bRoWn FoX",
    );
  });
});
