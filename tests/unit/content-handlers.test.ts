import { describe, it, expect } from 'vitest';
import { FetchRegistry } from '../../src/lib/fetch-registry.js';
import { truncateWithInfo } from '../../src/lib/content-handlers/util.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';

const enc = (value: string): Uint8Array => new TextEncoder().encode(value);

function registry(): FetchRegistry {
    const r = new FetchRegistry();
    r.init();
    return r;
}

describe('FetchRegistry', () => {
    it('init is idempotent (second call is a no-op)', () => {
        const r = new FetchRegistry();
        r.init();
        const h1 = r.getHandler('text/html');
        r.init();
        const h2 = r.getHandler('text/html');
        expect(h1).toBeDefined();
        expect(h2).toBeDefined();
        expect(h1!.name).toBe(h2!.name);
    });

    it('init does not override custom handlers', () => {
        const r = new FetchRegistry();
        const custom = {
            name: 'custom',
            match: () => true,
            handle: () => ({ result: 'ok', status: ResultStatus.Success })
        };
        r.register(custom);
        r.init();
        expect(r.getHandler('text/html')!.name).toBe('custom');
    });
});

describe('ContentHandlerRegistry', () => {
    it('returns handler for text/html', () => {
        const h = registry().getHandler('text/html');
        expect(h).toBeDefined();
        expect(h!.name).toBe('html');
    });

    it('returns handler for text/plain', () => {
        const h = registry().getHandler('text/plain');
        expect(h).toBeDefined();
        expect(h!.name).toBe('plain-text');
    });

    it('returns handler for application/json', () => {
        const h = registry().getHandler('application/json');
        expect(h).toBeDefined();
        expect(h!.name).toBe('json');
    });

    it('returns handler for application/vnd.api+json', () => {
        const h = registry().getHandler('application/vnd.api+json');
        expect(h).toBeDefined();
        expect(h!.name).toBe('json');
    });

    it('returns handler for application/xml', () => {
        const h = registry().getHandler('application/xml');
        expect(h).toBeDefined();
        expect(h!.name).toBe('xml');
    });

    it('returns handler for application/rss+xml', () => {
        const h = registry().getHandler('application/rss+xml');
        expect(h).toBeDefined();
        expect(h!.name).toBe('xml');
    });

    it('returns handler for text/xml', () => {
        const h = registry().getHandler('text/xml');
        expect(h).toBeDefined();
        expect(h!.name).toBe('xml');
    });

    it('returns handler for text/csv', () => {
        const h = registry().getHandler('text/csv');
        expect(h).toBeDefined();
        expect(h!.name).toBe('csv');
    });

    it('returns handler for text/markdown', () => {
        const h = registry().getHandler('text/markdown');
        expect(h).toBeDefined();
        expect(h!.name).toBe('markdown');
    });

    it('returns handler for text/javascript (generic text)', () => {
        const h = registry().getHandler('text/javascript');
        expect(h).toBeDefined();
        expect(h!.name).toBe('generic-text');
    });

    it('html handler takes priority over generic-text for text/html', () => {
        const h = registry().getHandler('text/html');
        expect(h).toBeDefined();
        expect(h!.name).toBe('html');
    });

    it('returns the pdf handler for application/pdf', () => {
        const h = registry().getHandler('application/pdf');
        expect(h).toBeDefined();
        expect(h!.name).toBe('pdf');
    });

    it('returns the pdf handler for application/x-pdf', () => {
        const h = registry().getHandler('application/x-pdf');
        expect(h).toBeDefined();
        expect(h!.name).toBe('pdf');
    });

    it('returns undefined for image/png', () => {
        expect(registry().getHandler('image/png')).toBeUndefined();
    });

    it('returns undefined for application/octet-stream', () => {
        expect(registry().getHandler('application/octet-stream')).toBeUndefined();
    });

    it('supports custom handler registration', () => {
        const r = new FetchRegistry();
        const custom = {
            name: 'custom',
            match: () => true,
            handle: () => ({ result: 'ok', status: ResultStatus.Success })
        };
        r.register(custom);
        expect(r.getHandler('anything')!.name).toBe('custom');
    });
});

describe('HTML handler', () => {
    it('extracts content from HTML page', async () => {
        const handler = registry().getHandler('text/html')!;
        const html = `<!DOCTYPE html>
<html><head><title>Test Page</title></head>
<body><article><h1>Article Title</h1><p>This is the article content with enough text to pass the readability threshold. It needs to be at least one hundred characters long so that the extractor treats it as meaningful content rather than noise or boilerplate. Here is some more padding to make sure we cross the threshold comfortably.</p></article></body></html>`;
        const result = await handler.handle(
            enc(html),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Article Title');
        expect(result.result).toContain('article content');
        expect(result.result).toContain('URL: http://example.com');
    });
});

describe('JSON handler', () => {
    it('returns pretty-printed JSON for valid JSON', async () => {
        const handler = registry().getHandler('application/json')!;
        const result = await handler.handle(
            enc('{"a":1,"b":2,"c":{"d":3}}'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('"a": 1');
        expect(result.result).toContain('"b": 2');
        expect(result.result).toContain('"d": 3');
    });

    it('returns error for invalid JSON', async () => {
        const handler = registry().getHandler('application/json')!;
        const result = await handler.handle(
            enc('{invalid}'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toBe('JSON could not be parsed');
    });

    it('truncates JSON output', async () => {
        const handler = registry().getHandler('application/json')!;
        const data = '{"a":' + JSON.stringify('x'.repeat(500)) + '}';
        const result = await handler.handle(
            enc(data),
            'http://example.com',
            'http://example.com',
            { maxChars: 50 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
        expect(result.result).toContain('JSON truncated to');
    });
});

describe('XML handler', () => {
    it('returns raw body as-is', async () => {
        const handler = registry().getHandler('application/xml')!;
        const result = await handler.handle(
            enc('<root><item id="1">value</item></root>'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('<root><item id="1">value</item></root>');
    });
});

describe('CSV handler', () => {
    it('returns raw body as-is', async () => {
        const handler = registry().getHandler('text/csv')!;
        const result = await handler.handle(
            enc('name,age\nAlice,30\nBob,25'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Alice');
        expect(result.result).toContain('Bob');
    });
});

describe('Markdown handler', () => {
    it('returns raw body as-is', async () => {
        const handler = registry().getHandler('text/markdown')!;
        const result = await handler.handle(
            enc('# Heading\n\nSome *emphasized* text.'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('# Heading');
        expect(result.result).toContain('*emphasized*');
    });
});

describe('Plain-text handler', () => {
    it('returns raw body as-is', async () => {
        const handler = registry().getHandler('text/plain')!;
        const result = await handler.handle(
            enc('Just some plain text'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toBe('Just some plain text');
    });

    it('appends a character-count hint when truncated', async () => {
        const handler = registry().getHandler('text/plain')!;
        const result = await handler.handle(
            enc('A'.repeat(200)),
            'http://example.com',
            'http://example.com',
            { maxChars: 20 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[text truncated to 20 of 200 characters]');
    });
});

describe('Generic text handler', () => {
    it('handles text/javascript as generic text', async () => {
        const handler = registry().getHandler('text/javascript')!;
        const result = await handler.handle(
            enc('const x = 1;'),
            'http://example.com',
            'http://example.com',
            { maxChars: 10000 }
        );
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('const x = 1;');
    });

    it('does not match text/html', () => {
        const handler = registry().getHandler('text/html')!;
        expect(handler.name).not.toBe('generic-text');
    });
});

describe('truncateWithInfo', () => {
    it('returns full text when under limit', () => {
        expect(truncateWithInfo('hello', 100).text).toBe('hello');
    });

    it('truncates at paragraph boundary', () => {
        const text = 'P1 text.\n\nP2 text.\n\nP3 text.\n\nP4 text.';
        const result = truncateWithInfo(text, 30).text;
        expect(result).toContain('[truncated]');
    });

    it('truncates at sentence boundary', () => {
        const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';
        const result = truncateWithInfo(text, 50).text;
        expect(result).toContain('[truncated]');
    });

    it('truncates at word boundary', () => {
        const text = 'word '.repeat(200);
        const result = truncateWithInfo(text, 100).text;
        expect(result).toContain('[truncated]');
        expect(result).toMatch(/ \.\.\. \[truncated\]$/);
    });

    it('truncates at hard cut when no boundary available', () => {
        const text = 'A'.repeat(500);
        const result = truncateWithInfo(text, 50).text;
        expect(result).toContain('[truncated]');
    });

    it('returns marker-only when budget exhausted by truncation overhead', () => {
        const result = truncateWithInfo('some text', 5).text;
        expect(result).toBe('... [truncated]');
    });

    it('reports retained and original lengths', () => {
        expect(truncateWithInfo('hello', 100)).toEqual({
            text: 'hello',
            keptLength: 5,
            originalLength: 5
        });
        expect(truncateWithInfo('A'.repeat(500), 50)).toEqual({
            text: 'A'.repeat(50) + ' [truncated]',
            keptLength: 50,
            originalLength: 500
        });
    });
});
