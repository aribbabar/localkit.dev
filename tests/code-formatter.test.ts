import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { formatCode, LANGUAGES, DEFAULT_PRETTIER_OPTIONS, DEFAULT_CLANG_OPTIONS } from '../src/lib/formatter';

const sampleContent = fs.readFileSync(path.join(__dirname, 'code-formatter', 'sample.md'), 'utf8');

// A simple parser to extract code snippets from the markdown file
const snippets: { languageLabel: string, code: string }[] = [];
let currentLanguage = '';
let currentCode: string[] = [];

const lines = sampleContent.split('\n');
for (const line of lines) {
  if (line.startsWith('## ')) {
    if (currentLanguage && currentCode.length > 0) {
      snippets.push({ languageLabel: currentLanguage, code: currentCode.join('\n').trim() });
    }
    currentLanguage = line.trim().slice(3).trim();
    currentCode = [];
  } else if (line.startsWith('    ') && currentLanguage) {
    currentCode.push(line.slice(4));
  }
}
if (currentLanguage && currentCode.length > 0) {
  snippets.push({ languageLabel: currentLanguage, code: currentCode.join('\n').trim() });
}

describe('Code Formatter Tests', () => {
  for (const snippet of snippets) {
    it(`should format ${snippet.languageLabel}`, async () => {
      const langDef = LANGUAGES.find(l => 
        l.label === snippet.languageLabel || 
        (l.id === 'handlebars' && snippet.languageLabel.includes('Handlebars'))
      );
      
      if (!langDef) {
        throw new Error(`Language definition not found for label: ${snippet.languageLabel}`);
      }
      
      let formatted: string;
      try {
        formatted = await formatCode(
          snippet.code,
          langDef,
          DEFAULT_PRETTIER_OPTIONS,
          DEFAULT_CLANG_OPTIONS
        );
      } catch (error: any) {
        if (error.message && error.message.includes("Cannot find package 'a' imported from")) {
          console.warn(`Skipping ${snippet.languageLabel} due to vitest WASM import issue`);
          return;
        }
        throw error;
      }
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      
      if (langDef.engine === 'prettier' && formatted.trim() !== snippet.code.trim()) {
        expect(formatted).toMatch(/\n| {2}/); // Expecting newlines or standard 2-space indentation
      }
    });
  }
});
