import { expect, test, describe } from 'vitest';
import {
  FileTypeProcessorRegistry,
  HTMLProcessor,
  JSONProcessor,
  MarkdownProcessor,
  DefaultTextProcessor,
} from '../processors/index.js';

describe('FileTypeProcessorRegistry', () => {
  test('singleton instance works correctly', () => {
    const instance1 = FileTypeProcessorRegistry.getInstance();
    const instance2 = FileTypeProcessorRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('processors are initialized by default', () => {
    const registry = FileTypeProcessorRegistry.getInstance();
    const htmlFile = 'test.html';
    const jsonFile = 'test.json';
    const mdFile = 'test.md';
    const txtFile = 'test.txt';

    expect(registry.findProcessor(htmlFile)).toBeInstanceOf(HTMLProcessor);
    expect(registry.findProcessor(jsonFile)).toBeInstanceOf(JSONProcessor);
    expect(registry.findProcessor(mdFile)).toBeInstanceOf(MarkdownProcessor);
    expect(registry.findProcessor(txtFile)).toBeInstanceOf(DefaultTextProcessor);
  });
});

describe('HTMLProcessor', () => {
  const processor = new HTMLProcessor();

  test('canProcess identifies HTML files correctly', () => {
    expect(processor.canProcess('test.html')).toBe(true);
    expect(processor.canProcess('test.HTML')).toBe(true);
    expect(processor.canProcess('test.txt')).toBe(false);
  });

  test('process handles HTML content correctly', async () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
        </head>
        <body>
          <script>console.log('test');</script>
          <h1>Test</h1>
          <p>Content</p>
          <img src="test.jpg" alt="test">
          <a href="https://test.com">Link</a>
        </body>
      </html>
    `;

    const result = await processor.process(html);
    expect(result.toLowerCase()).toContain('test');
    expect(result.toLowerCase()).toContain('content');
    expect(result.toLowerCase()).toContain('link');
    expect(result).not.toContain('style');
    expect(result).not.toContain('script');
    expect(result).not.toContain('console.log');
  });
});

describe('JSONProcessor', () => {
  const processor = new JSONProcessor();

  test('canProcess identifies JSON files correctly', () => {
    expect(processor.canProcess('test.json')).toBe(true);
    expect(processor.canProcess('test.JSON')).toBe(true);
    expect(processor.canProcess('test.txt')).toBe(false);
  });

  test('process handles JSON content correctly', async () => {
    const json = {
      test: 'value',
      nested: {
        array: [1, 2, 3]
      }
    };

    const result = await processor.process(JSON.stringify(json));
    expect(JSON.parse(result)).toEqual(json);
    expect(result).toContain('\n'); // Should be formatted
  });

  test('process falls back to text for invalid JSON', async () => {
    const invalidJson = 'invalid json';
    const result = await processor.process(invalidJson);
    expect(result).toBe(invalidJson);
  });

  test('process falls back to text for JSON with comments', async () => {
    const jsonWithComments = `{
      // This is a comment
      "test": "value",
      "nested": {
        "array": [1, 2, 3] // Another comment
      }
    }`;
    
    const result = await processor.process(jsonWithComments);
    expect(result).toBe(jsonWithComments);
  });

  test('process falls back to text for VS Code launch.json', async () => {
    const launchJson = `{
      // Use IntelliSense to learn about possible attributes.
      // Hover to view descriptions of existing attributes.
      "version": "0.3.0",
      "configurations": [
        {
          "name": "Debug",
          "type": "node",
          "request": "launch"
        }
      ]
    }`;
    
    const result = await processor.process(launchJson);
    expect(result).toBe(launchJson);
  });
});

describe('MarkdownProcessor', () => {
  const processor = new MarkdownProcessor();

  test('canProcess identifies Markdown files correctly', () => {
    expect(processor.canProcess('test.md')).toBe(true);
    expect(processor.canProcess('test.MD')).toBe(true);
    expect(processor.canProcess('test.txt')).toBe(false);
  });

  test('process preserves Markdown content', async () => {
    const markdown = '# Title\n\nContent with **bold** text';
    const result = await processor.process(markdown);
    expect(result).toBe(markdown);
  });
});

describe('DefaultTextProcessor', () => {
  const processor = new DefaultTextProcessor();

  test('canProcess accepts any file', () => {
    expect(processor.canProcess('test.txt')).toBe(true);
    expect(processor.canProcess('test.unknown')).toBe(true);
    expect(processor.canProcess('test')).toBe(true);
  });

  test('process preserves text content', async () => {
    const text = 'Simple text content\nWith multiple lines';
    const result = await processor.process(text);
    expect(result).toBe(text);
  });
});
