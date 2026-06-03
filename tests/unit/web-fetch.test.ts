import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebFetchConfiguration,
    WebFetchTool
} from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchError, mockFetchSequence, restoreFetch } from '../index.js';
import type { MockFetchResponse } from '../index.js';
import { fetchWithTimeout } from '../../src/lib/http.js';

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
    });

    afterEach(() => {
        restoreFetch();
    });

    it('fetches URL and returns extracted content', async () => {
        mockFetch(htmlResponse(SAMPLE_HTML));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Article Title');
        expect(result.result).toContain('article content');
    });

    it('reports missing url', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('url');
    });

    it('reports empty url', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: '' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('url');
    });

    it('reports non-string url', async () => {
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 123 });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('url');
    });

    it('handles HTTP error response', async () => {
        mockFetch({ ok: false, status: 404, statusText: 'Not Found', body: 'Not Found', headers: { 'content-type': 'text/html' } });
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com/404' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('HTTP error 404');
    });

    it('handles fetch exception', async () => {
        mockFetchError(new Error('Network failure'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://invalid.url.example' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('fetch error');
    });

    it('raw: true returns unprocessed HTML', async () => {
        mockFetch(htmlResponse('<html><body>Raw HTML</body></html>'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', raw: true });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Raw HTML');
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
        const result = await tool.execute({ url: 'https://example.com/data.json', raw: true });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('{"key": "value"}');
    });

    it('truncates content exceeding max_chars', async () => {
        const longContent = 'A'.repeat(500);
        const longHtml = `<html><body><article><p>${longContent}</p></article></body></html>`;
        mockFetch(htmlResponse(longHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', max_chars: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('respects per-request max_chars', async () => {
        const longContent = 'Hello world. This is a test sentence. '.repeat(20);
        const longHtml = `<html><body><article><p>${longContent}</p></article></body></html>`;
        mockFetch(htmlResponse(longHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', max_chars: 50 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('clamps max_chars to limit', async () => {
        mockFetch(htmlResponse('<html><body><p>short</p></body></html>'));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', max_chars: 999999 });
        expect(result.status).toBe(ResultStatus.Success);
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
        const result = await tool.execute({ url: 'https://example.com/doc.pdf' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Unsupported content type');
    });

    it('falls back to manual extraction for non-article pages', async () => {
        const plainHtml = `<!DOCTYPE html>
<html><head><title>Plain Page</title></head>
<body><div class="content">
<h1>Welcome</h1><p>This is a simple web page with enough text content to demonstrate the fallback extraction path when readability does not detect an article. The selector-based approach should find this content div and extract its text.</p>
</div></body></html>`;
        mockFetch(htmlResponse(plainHtml));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com/page' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Plain Page');
        expect(result.result).toContain('fallback extraction');
    });

    it('strips script and style elements before extraction', async () => {
        const htmlWithScript = `<!DOCTYPE html>
<html><head><title>Clean Page</title></head>
<body><script>alert('xss')</script><style>.hidden{display:none}</style>
<article><h1>Safe Content</h1><p>This is the actual article content with enough text to demonstrate that script and style elements are properly removed before extraction by the readability parser for clean output.</p></article></body></html>`;
        mockFetch(htmlResponse(htmlWithScript));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).not.toContain('xss');
        expect(result.result).not.toContain('hidden');
        expect(result.result).toContain('Safe Content');
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
        const result = await tool.execute({ url: 'https://example.com', max_chars: 5 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('truncates at paragraph boundary in raw mode', async () => {
        const textWithParas = 'P1 text.\n\nP2 text.\n\nP3 text.\n\nP4 text.\n\nP5 text.\n\nP6 text.\n\nP7 text.';
        mockFetch(htmlResponse(textWithParas));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', raw: true, max_chars: 50 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
    });

    it('truncation respects word boundaries', async () => {
        const text = 'word '.repeat(200);
        const html = `<html><body><article><p>${text}</p></article></body></html>`;
        mockFetch(htmlResponse(html));
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com', max_chars: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        const content = result.result as string;
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
        const result = await tool.execute({ url: 'https://example.com/huge' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Content too large');
    });

    it('handles HTTP error after HEAD succeeds', async () => {
        mockFetchSequence([
            { ok: true, status: 200, statusText: 'OK', body: '', headers: { 'content-type': 'text/html' } },
            { ok: false, status: 500, statusText: 'Internal Server Error', body: 'Error' }
        ]);
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('HTTP error 500');
    });

    it('handles non-Error thrown values in fetch', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue('string error');
        const tool = new WebFetchTool(cfg);
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Unknown fetch error');
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
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('https://example.com');
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
        const result = await tool.execute({ url: 'https://example.com' });
        expect(result.status).toBe(ResultStatus.Success);
    });
});
