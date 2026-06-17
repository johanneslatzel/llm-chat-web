import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    WebSearchConfiguration,
    WebSearchProvider,
    WebSearchTool,
} from '../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchSequence, restoreFetch } from '../index.js';

const { mockPMap } = vi.hoisted(() => ({ mockPMap: vi.fn() }));
vi.mock('p-map', () => ({ default: mockPMap }));

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

    it('returns search results from Tavily', async () => {
        mockFetch(makeSearchResponse([
            { title: 'Result 1', url: 'https://example.com/1', content: 'Content 1' }
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test query'] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Result 1');
    });

    it('reports missing queries', async () => {
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({});
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('queries');
    });

    it('reports empty queries array', async () => {
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: [] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('queries');
    });

    it('handles empty results', async () => {
        mockFetch(makeSearchResponse([]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['nothing'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('No search results');
    });

    it('uses DuckDuckGo provider', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        const ddgHtml = `<html><a rel="nofollow" class="result__a" href="https://example.com">Title</a><a class="result__snippet">Snippet text</a></html>`;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: ddgHtml });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ queries: ['ddg test'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Title');
    });

    it('handles DuckDuckGo redirect URLs', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        const encodedUrl = encodeURIComponent('https://real-example.com/page');
        const ddgHtml = `<html><a rel="nofollow" class="result__a" href="https://duckduckgo.com/l/?uddg=${encodedUrl}&amp;rut=abc">Result</a><a class="result__snippet">Description</a></html>`;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: ddgHtml });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('real-example.com');
    });

    it('handles Tavily API errors', async () => {
        mockFetch({ ok: false, status: 401, statusText: 'Unauthorized', body: 'Invalid API key' });
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Tavily');
    });

    it('handles DuckDuckGo HTTP errors', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        mockFetch({ ok: false, status: 503, statusText: 'Service Unavailable', body: '', headers: { 'content-type': 'text/html' } });
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('DuckDuckGo HTTP error (503):');
    });

    it('handles network errors', async () => {
        mockFetchSequence([
            makeSearchResponse([{ title: 'R1', url: 'https://x.com', content: 'C1' }])
        ]);
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('respects max_results parameter', async () => {
        mockFetch(makeSearchResponse([
            { title: 'R1', url: 'https://x.com/1', content: 'C1' },
            { title: 'R2', url: 'https://x.com/2', content: 'C2' },
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'], max_results: 1 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
    });

    it('uses ExaAI provider', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'exa-key');
        mockFetch(makeSearchResponse([
            { title: 'Exa Result', url: 'https://exa.example.com', content: 'Exa content' }
        ]));
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ queries: ['exa test'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Exa Result');
    });

    it('handles ExaAI API errors', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'bad-key');
        mockFetch({ ok: false, status: 403, statusText: 'Forbidden', body: 'Forbidden' });
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('ExaAI');
    });

    it('reports error for unknown provider', async () => {
        (cfg as any).provider = 'made-up';
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Unknown');
    });

    it('handles Tavily timeout', async () => {
        const timeoutCfg = new WebSearchConfiguration(WebSearchProvider.Tavily, 'test-key');
        (timeoutCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(timeoutCfg);
        const result = await tool.execute({ queries: ['test timeout'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
    });

    it('handles DuckDuckGo timeout', async () => {
        const ddgCfg = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
        (ddgCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(ddgCfg);
        const result = await tool.execute({ queries: ['timeout test'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
    });

    it('handles ExaAI timeout', async () => {
        const exaCfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'key');
        (exaCfg as any).searchTimeoutMs = 100;
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation timed out', 'TimeoutError')
        );
        const tool = new WebSearchTool(exaCfg);
        const result = await tool.execute({ queries: ['timeout'] });
        expect(result[0]!.status).toBe(ResultStatus.Error);
    });

    it('respects max_chars_per_result parameter', async () => {
        mockFetch(makeSearchResponse([
            { title: 'Result', url: 'https://example.com', content: 'Content' }
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'], max_chars_per_result: 100 });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('Result');
    });

    it('searches multiple queries and returns chained results', async () => {
        mockFetch(makeSearchResponse([
            { title: 'Result A', url: 'https://a.com', content: 'Content A' }
        ]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['query one', 'query two'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('query one');
        expect(result[1]!.status).toBe(ResultStatus.Success);
        expect(result[1]!.result).toContain('query two');
    });

    it('reports error for non-string query in array', async () => {
        mockFetch(makeSearchResponse([{ title: 'R', url: 'https://x.com', content: 'C' }]));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: [123 as unknown as string] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Query must be a non-empty string');
    });

    it('handles pMap throwing unexpectedly', async () => {
        mockPMap.mockRejectedValue(new Error('pMap exploded'));
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['test'] });
        expect(result).toHaveLength(1);
        expect(result[0]!.status).toBe(ResultStatus.Error);
        expect(result[0]!.result).toContain('Web search error');
    });

    it('reports individual errors per query while other queries succeed', async () => {
        let callCount = 0;
        vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve(new Response(
                    JSON.stringify({ results: [{ title: 'R1', url: 'https://x.com', content: 'C1' }] }),
                    { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } }
                ));
            }
            return Promise.reject(new Error('Network error'));
        });
        const tool = new WebSearchTool(cfg);
        const result = await tool.execute({ queries: ['valid', 'failing'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[1]!.status).toBe(ResultStatus.Error);
    });
});
