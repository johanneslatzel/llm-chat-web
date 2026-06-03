import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebSearchConfiguration,
    WebSearchProvider,
    WebSearchTool,
} from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchSequence, restoreFetch } from '../index.js';

function makeSearchResponse(results: Array<{title: string; url: string; content: string; score?: number}>) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ results })
    };
}

describe('WebSearchTool', () => {
    let cfg: WebSearchConfiguration;

    beforeEach(() => {
        cfg = new WebSearchConfiguration(WebSearchProvider.Tavily, 'test-key');
    });

    afterEach(() => {
        restoreFetch();
    });

    it('returns search results from Tavily', async () => {
        mockFetch(makeSearchResponse([
            { title: 'Result 1', url: 'https://example.com/1', content: 'Content 1' }
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test query' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Result 1');
    });

    it('reports missing query', async () => {
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({});
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('query');
    });

    it('reports empty query', async () => {
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: '' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('query');
    });

    it('handles empty results', async () => {
        mockFetch(makeSearchResponse([]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'nothing' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('No search results');
    });

    it('uses DuckDuckGo provider', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        const ddgHtml = `<html><a rel="nofollow" class="result__a" href="https://example.com">Title</a><a class="result__snippet">Snippet text</a></html>`;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: ddgHtml });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ query: 'ddg test' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Title');
    });

    it('handles DuckDuckGo redirect URLs', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        const encodedUrl = encodeURIComponent('https://real-example.com/page');
        const ddgHtml = `<html><a rel="nofollow" class="result__a" href="https://duckduckgo.com/l/?uddg=${encodedUrl}&amp;rut=abc">Result</a><a class="result__snippet">Description</a></html>`;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: ddgHtml });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('real-example.com');
    });

    it('handles Tavily API errors', async () => {
        mockFetch({ ok: false, status: 401, statusText: 'Unauthorized', body: 'Invalid API key' });
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Tavily');
    });

    it('handles DuckDuckGo HTTP errors', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        mockFetch({ ok: false, status: 503, statusText: 'Service Unavailable', body: '', headers: { 'content-type': 'text/html' } });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('DuckDuckGo HTTP error (503):');
    });

    it('handles network errors', async () => {
        mockFetchSequence([
            makeSearchResponse([{ title: 'R1', url: 'https://x.com', content: 'C1' }])
        ]);
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Success);
    });

    it('respects max_results parameter', async () => {
        mockFetch(makeSearchResponse([
            { title: 'R1', url: 'https://x.com/1', content: 'C1' },
            { title: 'R2', url: 'https://x.com/2', content: 'C2' },
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test', max_results: 1 });
        expect(result.status).toBe(ResultStatus.Success);
    });

    it('uses ExaAI provider', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'exa-key');
        mockFetch(makeSearchResponse([
            { title: 'Exa Result', url: 'https://exa.example.com', content: 'Exa content' }
        ]));
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ query: 'exa test' });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Exa Result');
    });

    it('handles ExaAI API errors', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'bad-key');
        mockFetch({ ok: false, status: 403, statusText: 'Forbidden', body: 'Forbidden' });
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('ExaAI');
    });

    it('reports error for unknown provider', async () => {
        (cfg as any).provider = 'made-up';
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test' });
        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toContain('Unknown');
    });

    it('handles Tavily timeout', async () => {
        const timeoutCfg = new WebSearchConfiguration(WebSearchProvider.Tavily, 'test-key');
        (timeoutCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(timeoutCfg);
        const result = await tool.execute({ query: 'test timeout' });
        expect(result.status).toBe(ResultStatus.Error);
    });

    it('handles DuckDuckGo timeout', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        (ddgCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ query: 'timeout test' });
        expect(result.status).toBe(ResultStatus.Error);
    });

    it('handles ExaAI timeout', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'key');
        (exaCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ query: 'timeout' });
        expect(result.status).toBe(ResultStatus.Error);
    });

    it('respects max_chars_per_result parameter', async () => {
        mockFetch(makeSearchResponse([
            { title: 'Result', url: 'https://example.com', content: 'Content' }
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ query: 'test', max_chars_per_result: 100 });
        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('Result');
    });
});
