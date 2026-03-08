import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  detectEntities,
  applyRedactions,
  createRedactedTextFile,
  type EntityType,
} from '../src/lib/redactor';

describe('Redactor Tool Tests', () => {
  const sampleTxtPath = path.join(__dirname, 'redactor', 'sample.txt');
  const sampleMdPath = path.join(__dirname, 'redactor', 'sample.md');
  
  const sampleTxt = fs.readFileSync(sampleTxtPath, 'utf8');
  const sampleMd = fs.readFileSync(sampleMdPath, 'utf8');

  describe('Entity Detection', () => {
    it('should detect entities using the compromise engine', async () => {
      const entityTypes: EntityType[] = ['name', 'email', 'phone', 'ssn'];
      
      const entities = await detectEntities(sampleTxt, {
        engine: 'compromise',
        entityTypes,
        style: 'placeholder'
      });
      
      expect(entities).toBeDefined();
      expect(Array.isArray(entities)).toBe(true);
      
      const typesFound = entities.map(e => e.type);
      expect(typesFound).toContain('email');
      expect(typesFound).toContain('phone');
      expect(typesFound).toContain('ssn');
      
      // Specifically check some expected values from sample.txt
      const emails = entities.filter(e => e.type === 'email').map(e => e.text);
      expect(emails).toContain('david.parker87@examplemail.com');
      
      const phones = entities.filter(e => e.type === 'phone').map(e => e.text);
      expect(phones.some(p => p.includes('410') && p.includes('555'))).toBe(true);
      
      const ssns = entities.filter(e => e.type === 'ssn').map(e => e.text);
      expect(ssns).toContain('493-72-1184');
    });

    it('should detect entities using the transformers engine', async () => {
      // Running transformers might take longer and require downloading models
      // We will test it on a shorter text snippet to save time.
      const snippet = "My name is John Doe and I live in New York. You can reach me at john.doe@example.com.";
      const entityTypes: EntityType[] = ['name', 'location', 'email'];
      
      try {
        const entities = await detectEntities(snippet, {
          engine: 'transformers',
          entityTypes,
          style: 'placeholder'
        });
        
        expect(entities).toBeDefined();
        expect(Array.isArray(entities)).toBe(true);
        
        const typesFound = entities.map(e => e.type);
        expect(typesFound).toContain('name');
        expect(typesFound).toContain('location');
        expect(typesFound).toContain('email');
        
        const names = entities.filter(e => e.type === 'name').map(e => e.text);
        expect(names).toContain('John Doe');
        
        const locations = entities.filter(e => e.type === 'location').map(e => e.text);
        expect(locations).toContain('New York');
      } catch (error: any) {
        if (error.message && error.message.includes('Unsupported device: "wasm"')) {
          console.warn('Skipping transformers test due to missing wasm support in vitest node environment');
          return;
        }
        throw error;
      }
    }, 30000); // 30s timeout for model loading
  });

  describe('Apply Redactions', () => {
    it('should replace text with placeholders', () => {
      const text = "Hello, my email is test@example.com and my phone is 555-1234.";
      const entities = [
        { type: 'email' as EntityType, text: 'test@example.com', start: 19, end: 35 },
        { type: 'phone' as EntityType, text: '555-1234', start: 52, end: 60 }
      ];
      
      const result = applyRedactions(text, entities, 'placeholder');
      expect(result).toBe("Hello, my email is [EMAIL] and my phone is [PHONE].");
    });

    it('should replace text with blackbox', () => {
      const text = "My SSN is 123-45-6789.";
      const entities = [
        { type: 'ssn' as EntityType, text: '123-45-6789', start: 10, end: 21 }
      ];
      
      const result = applyRedactions(text, entities, 'blackbox');
      const blackbox = "\u2588\u2588\u2588\u2588\u2588\u2588";
      expect(result).toBe(`My SSN is ${blackbox}.`);
    });
  });

  describe('File Handling', () => {
    it('should create a redacted text file properly', () => {
      const originalText = "Some text with secret@email.com";
      const redactedText = "Some text with [EMAIL]";
      
      const result = createRedactedTextFile("test.txt", redactedText);
      expect(result.name).toBe("test-redacted.txt");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("text/plain");
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    });
  });
});
