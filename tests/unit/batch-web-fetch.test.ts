import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    BatchWebFetchConfiguration,
    BatchWebFetchTool
} from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchError, mockFetchSequence, restoreFetch } from '../index.js';
import type { MockFetchResponse } from '../index.js';

const { mockPMap } = vi.hoisted(() => ({
    mockPMap: vi.fn()
}));
vi.mock('p-map', () => ({ default: mockPMap }));

function htmlResponse(
    body: string,
    status = 200
): MockFetchResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        body,
        headers: { 'content-type': 'text/html' }
    };
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>Test Page</title></head>
<body><article><h1>Article Title</h1><p>This is the article content with enough text to pass the readability threshold. It needs to be at least one hundred characters long so that the extractor treats it as meaningful content rather than noise or boilerplate. Here is some more padding to make sure we cross the threshold comfortably.</p></article></body></html>`;

describe('BatchWebFetchTool', () => {
    let cfg: BatchWebFetchConfiguration;

    beforeEach(() => {
        cfg = new BatchWebFetchConfiguration();
        mockPMap.mockImplementation(async (items: unknown[], mapper: Function) => {
            const results: unknown[] = [];
            for (let i = 0; i < items.length; i++) {
                results.push(await mapper(items[i], i));
            }
            return results;
        });
    });

    afterEach(() => {
        restoreFetch();
    });

    it('fetches multiple URLs and returns extracted content', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/a", "https://example.com/b"]' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Article Title');
        expect(result.result).toContain('article content');
        expect(result.result).toContain('example.com/a');
        expect(result.result).toContain('example.com/b');
        expect(result.result).toContain('2/2 URLs succeeded');
    });

    it('reports missing urls parameter', async () => {
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('urls');
    });

    it('reports empty urls array', async () => {
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '[]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('urls');
    });

    it('reports invalid JSON for urls', async () => {
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: 'not-json' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('urls');
    });

    it('reports non-string urls parameter', async () => {
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: 123 });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('urls');
    });

    it('handles partial success (some URLs fail, some succeed)', async () => {
        let callCount = 0;
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return Promise.resolve({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    text: () => Promise.resolve('Not Found'),
                    headers: new Headers({ 'content-type': 'text/html' })
                } as unknown as Response);
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(SAMPLE_HTML),
                headers: new Headers({ 'content-type': 'text/html' })
            } as unknown as Response);
        });

        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/fail", "https://example.com/ok"]' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('1/2 URLs succeeded');
        expect(result.result).toContain('[1] https://example.com/fail');
        expect(result.result).toContain('Error');
        expect(result.result).toContain('404');
    });

    it('handles all URLs failing', async () => {
        mockFetchError(new Error('Network failure'));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://invalid.example/a", "https://invalid.example/b"]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('0/2 URLs succeeded');
    });

    it('returns success when at least one URL succeeds', async () => {
        let callCount = 0;
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
            callCount++;
            if (callCount <= 2) {
                return Promise.resolve({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    text: () => Promise.resolve('Not Found'),
                    headers: new Headers({ 'content-type': 'text/html' })
                } as unknown as Response);
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: () => Promise.resolve(SAMPLE_HTML),
                headers: new Headers({ 'content-type': 'text/html' })
            } as unknown as Response);
        });

        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/fail", "https://example.com/ok"]' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('1/2 URLs succeeded');
        expect(result.result).toContain('[1] https://example.com/fail');
        expect(result.result).toContain('[2] https://example.com/ok');
    });

    it('raw: true returns unprocessed HTML for each URL', async () => {
        mockFetch(htmlResponse('<html><body>Raw HTML</body></html>'));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/a", "https://example.com/b"]', raw: true });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Raw HTML');
        expect(result.result).toContain('2/2 URLs succeeded');
    });

    it('truncates content exceeding max_chars', async () => {
        const longContent = 'A'.repeat(500);
        const longHtml = `<html><body><article><p>${longContent}</p></article></body></html>`;
        mockFetch(htmlResponse(longHtml));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/long"]', max_chars: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('respects concurrency parameter', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({
            urls: '["https://example.com/a", "https://example.com/b", "https://example.com/c"]',
            concurrency: 2
        });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('3/3 URLs succeeded');
    });

    it('clamps concurrency to max', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({
            urls: '["https://example.com/a"]',
            concurrency: 999
        });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('1/1 URLs succeeded');
    });

    it('clamps max_chars to limit', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/a"]', max_chars: 999999 });
        expect(result.status).toBe(ResultStatus.Success);
    });

    it('handles mixed content types with raw: true', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '{"key":"value"}',
            headers: { 'content-type': 'application/json' }
        });
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/data.json"]', raw: true });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('{"key":"value"}');
    });

    it('truncates at paragraph boundary in raw mode', async () => {
        const text = 'P1 text.\n\nP2 text.\n\nP3 text.\n\nP4 text.\n\nP5 text.\n\nP6 text.\n\nP7 text.';
        mockFetch(htmlResponse(text));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]', raw: true, max_chars: 50 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('truncates at sentence boundary when no paragraph break in budget', async () => {
        const text = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven.';
        mockFetch(htmlResponse(text));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]', raw: true, max_chars: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('truncates at word boundary when no sentence break in budget', async () => {
        const text = 'word '.repeat(200);
        mockFetch(htmlResponse(text));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]', raw: true, max_chars: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('proceeds when content-length is under the limit', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: SAMPLE_HTML,
            headers: { 'content-type': 'text/html', 'content-length': '500' }
        });
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Article Title');
    });

    it('handles HTTP error after HEAD succeeds', async () => {
        mockFetchSequence([
            { ok: true, status: 200, statusText: 'OK', body: '', headers: { 'content-type': 'text/html' } },
            { ok: false, status: 500, statusText: 'Server Error', body: 'Error', headers: { 'content-type': 'text/html' } }
        ]);
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('HTTP error 500');
    });

    it('rejects non-HTML content type', async () => {
        mockFetchSequence([
            { ok: true, status: 200, statusText: 'OK', body: '', headers: { 'content-type': 'text/html' } },
            { ok: true, status: 200, statusText: 'OK', body: '%PDF-1.4...', headers: { 'content-type': 'application/pdf' } }
        ]);
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com/doc.pdf"]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Unsupported content type');
    });

    it('rejects content exceeding max content length via HEAD in batch mode', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: SAMPLE_HTML,
            headers: { 'content-type': 'text/html', 'content-length': '50000000' }
        });
        const bigCfg = new BatchWebFetchConfiguration();
        (bigCfg as any).fetchConfig.maxContentLengthBytes = 1000;
        const tool = new BatchWebFetchTool(bigCfg);
        const result = await tool.execute({ urls: '["https://example.com/huge"]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Content too large');
    });

    it('handles pMap throwing unexpectedly', async () => {
        mockPMap.mockRejectedValue(new Error('pMap failed'));
        const tool = new BatchWebFetchTool(cfg);
        const result = await tool.execute({ urls: '["https://example.com"]' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Batch web fetch error');
    });
});
