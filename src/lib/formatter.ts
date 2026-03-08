import type { Options as PrettierOptions } from "prettier";

/* ------------------------------------------------------------------ */
/*  Language definitions                                               */
/* ------------------------------------------------------------------ */

export type Engine = "prettier" | "clang-format";

export interface LanguageDef {
  id: string;
  label: string;
  engine: Engine;
  group: string;
  /** Prettier parser name */
  parser?: string;
  /** clang-format: filename hint so it picks the right grammar */
  filename?: string;
  /** Placeholder sample shown in the input editor */
  placeholder: string;
}

export const LANGUAGES: LanguageDef[] = [
  // ── Prettier: JavaScript / TypeScript ─────────────────────────────
  {
    id: "javascript",
    label: "JavaScript",
    engine: "prettier",
    group: "JavaScript / TypeScript",
    parser: "babel",
    placeholder: `const greet=(name)=>{return "Hello, "+name+"!"}
greet("world")`,
  },
  {
    id: "jsx",
    label: "JSX",
    engine: "prettier",
    group: "JavaScript / TypeScript",
    parser: "babel",
    placeholder: `const App=()=>{return <div className="app"><h1>Hello</h1><p>World</p></div>}`,
  },
  {
    id: "typescript",
    label: "TypeScript",
    engine: "prettier",
    group: "JavaScript / TypeScript",
    parser: "typescript",
    placeholder: `interface User{name:string;age:number}
function greet(user:User):string{return "Hello, "+user.name}`,
  },
  {
    id: "tsx",
    label: "TSX",
    engine: "prettier",
    group: "JavaScript / TypeScript",
    parser: "typescript",
    placeholder: `const App:React.FC<{title:string}>=({title})=>{return <div><h1>{title}</h1></div>}`,
  },
  {
    id: "flow",
    label: "Flow",
    engine: "prettier",
    group: "JavaScript / TypeScript",
    parser: "babel-flow",
    placeholder: `// @flow
function square(n: number): number {return n*n}`,
  },
  // ── Prettier: Angular / Vue ───────────────────────────────────────
  {
    id: "angular",
    label: "Angular",
    engine: "prettier",
    group: "Markup",
    parser: "angular",
    placeholder: `<div *ngIf="show"><app-header [title]="pageTitle" (click)="onHeaderClick($event)"></app-header></div>`,
  },
  {
    id: "vue",
    label: "Vue",
    engine: "prettier",
    group: "Markup",
    parser: "vue",
    placeholder: `<template><div class="app"><h1>{{ title }}</h1><p v-if="show">Hello</p></div></template>
<script setup>
import {ref} from 'vue'
const title=ref('Hello World')
</script>`,
  },
  // ── Prettier: Markup ──────────────────────────────────────────────
  {
    id: "html",
    label: "HTML",
    engine: "prettier",
    group: "Markup",
    parser: "html",
    placeholder: `<html><head><title>Page</title></head><body><div class="container"><h1>Hello World</h1><p>This is a paragraph.</p></div></body></html>`,
  },
  {
    id: "handlebars",
    label: "Ember / Handlebars",
    engine: "prettier",
    group: "Markup",
    parser: "glimmer",
    placeholder: `<div class="greeting">{{#if isLoggedIn}}<h1>Welcome back, {{user.name}}!</h1>{{else}}<h1>Please log in</h1>{{/if}}</div>`,
  },
  // ── Prettier: Styles ──────────────────────────────────────────────
  {
    id: "css",
    label: "CSS",
    engine: "prettier",
    group: "Styles",
    parser: "css",
    placeholder: `.container{display:flex;justify-content:center;align-items:center;gap:1rem}
.container .item{padding:8px 16px;border-radius:4px;background:#f0f0f0}`,
  },
  {
    id: "less",
    label: "Less",
    engine: "prettier",
    group: "Styles",
    parser: "less",
    placeholder: `@primary:#333;.container{color:@primary;.item{padding:8px;background:lighten(@primary,50%)}}`,
  },
  {
    id: "scss",
    label: "SCSS",
    engine: "prettier",
    group: "Styles",
    parser: "scss",
    placeholder: `$primary:#333;.container{color:$primary;.item{padding:8px;background:lighten($primary,50%)}}`,
  },
  // ── Prettier: Data / Config ───────────────────────────────────────
  {
    id: "json",
    label: "JSON",
    engine: "prettier",
    group: "Data / Config",
    parser: "json",
    placeholder: `{"name":"project","version":"1.0.0","dependencies":{"react":"^19.0.0","typescript":"^5.0.0"},"scripts":{"dev":"vite","build":"vite build"}}`,
  },
  {
    id: "graphql",
    label: "GraphQL",
    engine: "prettier",
    group: "Data / Config",
    parser: "graphql",
    placeholder: `query GetUser($id:ID!){user(id:$id){name email posts{title createdAt}}}`,
  },
  {
    id: "yaml",
    label: "YAML",
    engine: "prettier",
    group: "Data / Config",
    parser: "yaml",
    placeholder: `name: project
version: 1.0.0
dependencies:
    react: ^19.0.0
    typescript:    ^5.0.0`,
  },
  // ── Prettier: Prose ───────────────────────────────────────────────
  {
    id: "markdown",
    label: "Markdown",
    engine: "prettier",
    group: "Prose",
    parser: "markdown",
    placeholder: `#  Hello World
This is a paragraph with **bold** and *italic* text.

-  Item one
-  Item two
-  Item three

| Column 1 | Column 2 |
|---|---|
| Cell 1 | Cell 2 |`,
  },
  {
    id: "mdx",
    label: "MDX",
    engine: "prettier",
    group: "Prose",
    parser: "mdx",
    placeholder: `import {Chart} from './components'

#  Dashboard

<Chart data={[1,2,3]} color="blue" />

Some **markdown** content here.`,
  },
  // ── clang-format ──────────────────────────────────────────────────
  {
    id: "c",
    label: "C",
    engine: "clang-format",
    group: "C / C++",
    filename: "main.c",
    placeholder: `#include <stdio.h>
int main(){printf("Hello World!\\n");return 0;}`,
  },
  {
    id: "cpp",
    label: "C++",
    engine: "clang-format",
    group: "C / C++",
    filename: "main.cpp",
    placeholder: `#include <iostream>
using namespace std;
auto main() -> int{std::cout << "Hello World!" << std::endl;return 0;}`,
  },
  {
    id: "java",
    label: "Java",
    engine: "clang-format",
    group: "JVM / .NET",
    filename: "Main.java",
    placeholder: `public class Main{public static void main(String[] args){System.out.println("Hello World!");}}`,
  },
  {
    id: "csharp",
    label: "C#",
    engine: "clang-format",
    group: "JVM / .NET",
    filename: "Main.cs",
    placeholder: `using System;class Program{static void Main(){Console.WriteLine("Hello World!");}}`,
  },
  {
    id: "objectivec",
    label: "Objective-C",
    engine: "clang-format",
    group: "C / C++",
    filename: "main.m",
    placeholder: `#import <Foundation/Foundation.h>
int main(int argc,const char*argv[]){@autoreleasepool{NSLog(@"Hello World!");}return 0;}`,
  },
  {
    id: "protobuf",
    label: "Protobuf",
    engine: "clang-format",
    group: "Data / Config",
    filename: "main.proto",
    placeholder: `syntax="proto3";
message Person{string name=1;int32 id=2;string email=3;}`,
  },
  {
    id: "js-clang",
    label: "JavaScript (clang)",
    engine: "clang-format",
    group: "JavaScript / TypeScript",
    filename: "main.js",
    placeholder: `function greet(name){return "Hello, "+name+"!"}
greet("world")`,
  },
  {
    id: "json-clang",
    label: "JSON (clang)",
    engine: "clang-format",
    group: "Data / Config",
    filename: "main.json",
    placeholder: `{"name":"project","version":"1.0.0","dependencies":{"react":"^19.0.0"}}`,
  },
];

/* ------------------------------------------------------------------ */
/*  Prettier options exposed to the user                               */
/* ------------------------------------------------------------------ */

export interface PrettierUserOptions {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "all" | "es5" | "none";
  bracketSpacing: boolean;
  bracketSameLine: boolean;
  arrowParens: "always" | "avoid";
  proseWrap: "always" | "never" | "preserve";
  singleAttributePerLine: boolean;
  endOfLine: "lf" | "crlf" | "cr" | "auto";
}

export const DEFAULT_PRETTIER_OPTIONS: PrettierUserOptions = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  proseWrap: "preserve",
  singleAttributePerLine: false,
  endOfLine: "lf",
};

/* ------------------------------------------------------------------ */
/*  clang-format presets                                                */
/* ------------------------------------------------------------------ */

export const CLANG_PRESETS = [
  "LLVM",
  "GNU",
  "Google",
  "Chromium",
  "Microsoft",
  "Mozilla",
  "WebKit",
] as const;

export type ClangPreset = (typeof CLANG_PRESETS)[number];

export interface ClangUserOptions {
  preset: ClangPreset;
  indentWidth: number;
  columnLimit: number;
}

export const DEFAULT_CLANG_OPTIONS: ClangUserOptions = {
  preset: "LLVM",
  indentWidth: 4,
  columnLimit: 80,
};

/* ------------------------------------------------------------------ */
/*  Lazy-loaded singletons                                             */
/* ------------------------------------------------------------------ */

type PrettierStandalone = typeof import("prettier/standalone");

let prettierPromise: Promise<PrettierStandalone> | null = null;
let prettierPlugins: Promise<unknown[]> | null = null;

async function getPrettier() {
  if (!prettierPromise) {
    prettierPromise = import("prettier/standalone");
  }
  if (!prettierPlugins) {
    prettierPlugins = Promise.all([
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/flow"),
      import("prettier/plugins/typescript"),
      import("prettier/plugins/angular"),
      import("prettier/plugins/html"),
      import("prettier/plugins/postcss"),
      import("prettier/plugins/glimmer"),
      import("prettier/plugins/graphql"),
      import("prettier/plugins/markdown"),
      import("prettier/plugins/yaml"),
    ]);
  }
  const [prettier, plugins] = await Promise.all([prettierPromise, prettierPlugins]);
  return { prettier, plugins };
}

type ClangFormat = { format: (source: string, filename: string, style: string) => string };
let clangPromise: Promise<ClangFormat> | null = null;

async function getClang(): Promise<ClangFormat> {
  if (!clangPromise) {
    clangPromise = (async () => {
      const mod = await import("@wasm-fmt/clang-format/vite");
      await mod.default();
      return mod as unknown as ClangFormat;
    })();
  }
  return clangPromise;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function formatWithPrettier(
  source: string,
  lang: LanguageDef,
  options: PrettierUserOptions,
): Promise<string> {
  const { prettier, plugins } = await getPrettier();
  const opts: PrettierOptions = {
    parser: lang.parser!,
    plugins: plugins as PrettierOptions["plugins"],
    ...options,
  };
  return prettier.format(source, opts);
}

export async function formatWithClang(
  source: string,
  lang: LanguageDef,
  options: ClangUserOptions,
): Promise<string> {
  const clang = await getClang();
  const style = JSON.stringify({
    BasedOnStyle: options.preset,
    IndentWidth: options.indentWidth,
    ColumnLimit: options.columnLimit,
  });
  return clang.format(source, lang.filename!, style);
}

export async function formatCode(
  source: string,
  lang: LanguageDef,
  prettierOpts: PrettierUserOptions,
  clangOpts: ClangUserOptions,
): Promise<string> {
  if (lang.engine === "prettier") {
    return formatWithPrettier(source, lang, prettierOpts);
  }
  return formatWithClang(source, lang, clangOpts);
}
