import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebFetchConfiguration,
    WebFetchTool
} from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchError, mockFetchSequence, restoreFetch } from '../index.js';
import type { MockFetchResponse } from '../index.js';
import { fetchWithTimeout } from '../../src/lib/http.js';

const { mockPMap } = vi.hoisted(() => ({ mockPMap: vi.fn() }));
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

describe('WebFetchTool', () => {
    let cfg: WebFetchConfiguration;

    beforeEach(() => {
        cfg = new WebFetchConfiguration();
        mockPMap.mockImplementation(
            async <T>(items: readonly (() => T)[], _mapper: (item: () => T) => T, _options: unknown): Promise<T[]> => {
                const results: T[] = [];
                for (const item of items) {
                    results.push(await _mapper(item));
                }
                return results;
            }
        );
    });

    afterEach(() => {
        restoreFetch();
    });

    it('fetches single URL and returns extracted content', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Article Title');
        expect(result[0]!.result).toContain('article content');
    });

    it('reports missing urls', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({});
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('urls');
    });

    it('reports empty urls array', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: [] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('urls');
    });

    it('handles HTTP error response', async () => {
        mockFetch({ ok: false, status: 404, statusText: 'Not Found', body: 'Not Found', headers: { 'content-type': 'text/html' } });
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/404'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('HTTP error 404');
    });

    it('handles fetch exception', async () => {
        mockFetchError(new Error('Network failure'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://invalid.url.example'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('fetch error');
    });

    it('raw: true returns unprocessed HTML', async () => {
        mockFetch(htmlResponse('<html><body>Raw HTML</body></html>'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Raw HTML');
    });

    it('raw: true accepts non-HTML content types', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '{"key": "value"}',
            headers: { 'content-type': 'application/json' }
        });
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/data.json'], raw: true });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('{"key": "value"}');
    });

    it('truncates content exceeding max_chars', async () => {
        const longContent = 'A'.repeat(500);
        const longHtml = `<html><body><article><p>${longContent}</p></article></body></html>`;
        mockFetch(htmlResponse(longHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 100 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('respects per-request max_chars', async () => {
        const longContent = 'Hello world. This is a test sentence. '.repeat(20);
        const longHtml = `<html><body><article><p>${longContent}</p></article></body></html>`;
        mockFetch(htmlResponse(longHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 50 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('clamps max_chars to limit', async () => {
        mockFetch(htmlResponse('<html><body><p>short</p></body></html>'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 999999 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('rejects non-HTML content-type', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '%PDF-1.4...',
            headers: { 'content-type': 'application/pdf' }
        });
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/doc.pdf'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Unsupported content type');
    });

    it('falls back to manual extraction for non-article pages', async () => {
        const plainHtml = `<!DOCTYPE html>
<html><head><title>Plain Page</title></head>
<body><div class="content">
<h1>Welcome</h1><p>This is a simple web page with enough text content to demonstrate the fallback extraction path when readability does not detect an article. The selector-based approach should find this content div and extract its text.</p>
</div></body></html>`;
        mockFetch(htmlResponse(plainHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/page'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Plain Page');
        expect(result[0]!.result).toContain('fallback extraction');
    });

    it('strips script and style elements before extraction', async () => {
        const htmlWithScript = `<!DOCTYPE html>
<html><head><title>Clean Page</title></head>
<body><script>alert('xss')</script><style>.hidden{display:none}</style>
<article><h1>Safe Content</h1><p>This is the actual article content with enough text to demonstrate that script and style elements are properly removed before extraction by the readability parser for clean output.</p></article></body></html>`;
        mockFetch(htmlResponse(htmlWithScript));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).not.toContain('xss');
        expect(result[0]!.result).not.toContain('hidden');
        expect(result[0]!.result).toContain('Safe Content');
    });

    it('merges custom headers with defaults in fetchWithTimeout', async () => {
        mockFetch(htmlResponse('<html>ok</html>'));
        const response = await fetchWithTimeout('https://example.com', {
            headers: { 'X-Custom': 'val' }
        });
        const text = await response.text();
        expect(text).toBe('<html>ok</html>');
    });

    it('returns marker-only when budget exhausted by truncation overhead', async () => {
        mockFetch(htmlResponse('some text here'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 5 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('truncates at paragraph boundary in raw mode', async () => {
        const textWithParas = 'P1 text.\n\nP2 text.\n\nP3 text.\n\nP4 text.\n\nP5 text.\n\nP6 text.\n\nP7 text.';
        mockFetch(htmlResponse(textWithParas));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true, max_chars: 50 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('truncation respects word boundaries', async () => {
        const text = 'word '.repeat(200);
        const html = `<html><body><article><p>${text}</p></article></body></html>`;
        mockFetch(htmlResponse(html));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 100 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        const content = result[0]!.result as string;
        expect(content).toContain('[truncated]');
        const truncatedText = content.replace(/[\s\S]*?\n\n/, '').replace(/\n\nURL:.*/, '');
        expect(truncatedText).toMatch(/ \.\.\. \[truncated\]$/);
    });

    it('rejects content exceeding max content length via HEAD', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '',
            headers: { 'content-type': 'text/html', 'content-length': '50000000' }
        });
        const bigCfg = new WebFetchConfiguration();
        (bigCfg as any).maxContentLengthBytes = 1000;
        const tool = new WebFetchTool(bigCfg);
        const result = await tool.execute({ urls: ['https://example.com/huge'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Content too large');
    });

    it('handles HTTP error after HEAD succeeds', async () => {
        mockFetchSequence([
            { ok: true, status: 200, statusText: 'OK', body: '', headers: { 'content-type': 'text/html' } },
            { ok: false, status: 500, statusText: 'Internal Server Error', body: 'Error' }
        ]);
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('HTTP error 500');
    });

    it('handles non-Error thrown values in fetch', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue('string error');
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Unknown fetch error');
    });

    it('uses trimmedUrl when response.url is empty', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () =>
                Promise.resolve(
                    '<html><body><article><p>Content with enough text for extraction and testing the url fallback behavior in this scenario.</p></article></body></html>'
                ),
            headers: new Headers({ 'content-type': 'text/html' }),
            url: ''
        } as unknown as Response);
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('https://example.com');
    });

    it('falls back to text/plain when content-type header is missing', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () =>
                Promise.resolve(
                    'plain text content that is long enough for extraction and testing purposes in this test scenario for the fallback path.'
                ),
            headers: { get: () => null, forEach: () => {} },
            url: 'http://example.com'
        } as unknown as Response);
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('fetches multiple URLs and returns chained results', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/a', 'https://example.com/b'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Article Title');
        expect(result[1]!.status).toBe(ResultStatus.Success);
        expect(result[1]!.result).toContain('Article Title');
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

        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com/fail', 'https://example.com/ok'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('404');
        expect(result[1]!.status).toBe(ResultStatus.Success);
        expect(result[1]!.result).toContain('Article Title');
    });

    it('handles all URLs failing', async () => {
        mockFetchError(new Error('Network failure'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://invalid.example/a', 'https://invalid.example/b'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[1]!.status).toBe(ResultStatus.Error);
    });

    it('truncates at paragraph boundary in non-raw mode', async () => {
        const textWithParas = 'P1 text.\n\nP2 text.\n\nP3 text.\n\nP4 text.\n\nP5 text.\n\nP6 text.\n\nP7 text.';
        mockFetch(htmlResponse(textWithParas));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], max_chars: 50 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('truncates at sentence boundary in raw mode', async () => {
        const text = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven.';
        mockFetch(htmlResponse(text));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true, max_chars: 100 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('truncates at word boundary when no sentence break in raw mode', async () => {
        const text = 'word '.repeat(200);
        mockFetch(htmlResponse(text));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true, max_chars: 100 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('truncates at hard cut in raw mode when no other boundary available', async () => {
        const text = 'A'.repeat(500);
        mockFetch(htmlResponse(text));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true, max_chars: 50 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('returns marker-only when budget exhausted by truncation overhead in raw mode', async () => {
        mockFetch(htmlResponse('some text here'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'], raw: true, max_chars: 5 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('[truncated]');
    });

    it('reports error for non-string URL in array', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: [123 as unknown as string] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('URL must be a non-empty string');
    });

    it('handles pMap throwing unexpectedly', async () => {
        mockPMap.mockRejectedValue(new Error('pMap exploded'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ urls: ['https://example.com'] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Web fetch error');
    });
});
