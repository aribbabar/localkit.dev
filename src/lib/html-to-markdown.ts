import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HtmlToMdOptions {
  headingStyle: "atx" | "setext";
  bulletListMarker: "-" | "*" | "+";
  codeBlockStyle: "fenced" | "indented";
  linkStyle: "inlined" | "referenced";
  stripStyles: boolean;
  stripScripts: boolean;
  stripImages: boolean;
  preserveLineBreaks: boolean;
  enableGfm: boolean;
}

export const DEFAULT_OPTIONS: HtmlToMdOptions = {
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  linkStyle: "inlined",
  stripStyles: true,
  stripScripts: true,
  stripImages: false,
  preserveLineBreaks: false,
  enableGfm: true,
};

/* ------------------------------------------------------------------ */
/*  Preprocessing                                                      */
/* ------------------------------------------------------------------ */

function preprocessHtml(html: string, options: HtmlToMdOptions): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (options.stripScripts) {
    doc.querySelectorAll("script").forEach((el) => el.remove());
  }

  if (options.stripStyles) {
    doc.querySelectorAll("style").forEach((el) => el.remove());
    doc.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
  }

  if (options.stripImages) {
    doc.querySelectorAll("img").forEach((el) => el.remove());
  }

  return doc.body.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function convertHtmlToMarkdown(html: string, options: HtmlToMdOptions): string {
  const cleaned = preprocessHtml(html, options);

  const service = new TurndownService({
    headingStyle: options.headingStyle === "atx" ? "atx" : "setext",
    bulletListMarker: options.bulletListMarker,
    codeBlockStyle: options.codeBlockStyle,
    linkStyle: options.linkStyle,
    br: options.preserveLineBreaks ? "\n" : "",
  });

  if (options.enableGfm) {
    service.use(gfm);
  }

  return service.turndown(cleaned);
}
