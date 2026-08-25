import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    WebSearchConfiguration,
    WebSearchProvider,
    WebSearchTool,
    ProviderStrategy
} from '../../../src/index.js';
import { ResultStatus } from '@johannes.latzel/llm-chat';
import { mockFetch, mockFetchSequence, restoreFetch } from '../../index.js';

const { mockPMap } = vi.hoisted(() => ({ mockPMap: vi.fn() }));
vi.mock('p-map', () => ({ default: mockPMap }));

const TAVILY_BODY = JSON.stringify({
    results: [{ title: 'T-Result', url: 'https://tavily.com/r', content: 'tc', score: 1 }]
});
/** Body parseable by both Tavily (content/raw_content) and ExaAI (text) providers. */
const COMBINED_BODY = JSON.stringify({
    results: [
        {
            title: 'T-Result',
            url: 'https://tavily.com/r',
            content: 'c1',
            raw_content: 'c1',
            text: 't1',
            score: 1
        },
        {
            title: 'E-Result',
            url: 'https://exa.ai/r',
            content: 'c2',
            raw_content: 'c2',
            text: 't2',
            score: 1
        }
    ]
});

interface CapturedUrls {
    urls: string[];
}

/** Spies on global fetch recording request URLs; always answers with body. */
function captureFetch(body: string): CapturedUrls {
    const urls: string[] = [];
    const impl = async (input: RequestInfo | URL): Promise<Response> => {
        urls.push(String(input));
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
            headers: new Headers({ 'content-type': 'application/json' }),
            url: String(input)
        } as unknown as Response;
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(impl as unknown as typeof fetch);
    return { urls };
}

describe('WebSearchTool multi-provider strategies', () => {
    let origEnv: Record<string, string | undefined>;

    beforeEach(() => {
        origEnv = { ...process.env };
        mockPMap.mockImplementation(
            async <T>(
                items: readonly (() => T)[],
                _mapper: (item: () => T) => T
            ): Promise<T[]> => {
                const results: T[] = [];
                for (const item of items) {
                    results.push(await _mapper(item));
                }
                return results;
            }
        );
    });

    afterEach(() => {
        process.env = origEnv;
        restoreFetch();
        vi.restoreAllMocks();
    });

    it('falls back to the next provider when the first fails end-to-end', async () => {
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'tv-key' },
                { provider: WebSearchProvider.ExaAI, apiKey: 'ex-key' }
            ],
            ProviderStrategy.Fallback
        );
        mockFetchSequence([
            { ok: false, status: 500, statusText: 'Internal Server Error', body: 'boom' },
            { ok: true, status: 200, statusText: 'OK', body: COMBINED_BODY }
        ]);
        const result = await new WebSearchTool(cfg).execute({ queries: ['q'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('T-Result');
    });

    it('selects a provider by weight end-to-end for weighted random strategy', async () => {
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'tv-key' },
                { provider: WebSearchProvider.DuckDuckGo }
            ],
            ProviderStrategy.WeightedRandom
        );
        // roll = 0.25 * (1 + 1) = 0.5 -> consumed by the first entry (Tavily).
        vi.spyOn(Math, 'random').mockReturnValue(0.25);
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: TAVILY_BODY });
        const result = await new WebSearchTool(cfg).execute({ queries: ['q'] });
        expect(result[0]!.status).toBe(ResultStatus.Success);
        expect(result[0]!.result).toContain('https://tavily.com/r');
    });

    it('cycles through providers across consecutive queries end-to-end', async () => {
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'tv-key' },
                { provider: WebSearchProvider.ExaAI, apiKey: 'ex-key' }
            ],
            ProviderStrategy.RoundRobin
        );
        const captured = captureFetch(COMBINED_BODY);
        const result = await new WebSearchTool(cfg).execute({ queries: ['q1', 'q2'] });
        expect(result).toHaveLength(2);
        expect(result[0]!.status, String(result[0]!.result)).toBe(ResultStatus.Success);
        expect(result[1]!.status, String(result[1]!.result)).toBe(ResultStatus.Success);
        expect(captured.urls[0]).toContain('api.tavily.com');
        expect(captured.urls[1]).toContain('api.exa.ai');
    });
});

    it('caps concurrency at 1 when every provider entry is duckduckgo', async () => {
        const cfg = new WebSearchConfiguration([{ provider: WebSearchProvider.DuckDuckGo }]);
        cfg.concurrency = 4;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: '<html></html>' });
        await new WebSearchTool(cfg).execute({ queries: ['q1', 'q2'] });
        const calls = mockPMap.mock.calls;
        const options = calls[calls.length - 1]![2] as { concurrency: number };
        expect(options.concurrency).toBe(1);
    });

    it('applies the configured concurrency when any non-duckduckgo entry exists', async () => {
        const cfg = new WebSearchConfiguration([
            { provider: WebSearchProvider.Tavily, apiKey: 'tv-key' },
            { provider: WebSearchProvider.DuckDuckGo }
        ]);
        cfg.concurrency = 4;
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: TAVILY_BODY });
        await new WebSearchTool(cfg).execute({ queries: ['q1', 'q2'] });
        const calls = mockPMap.mock.calls;
        const options = calls[calls.length - 1]![2] as { concurrency: number };
        expect(options.concurrency).toBe(4);
    });

    it('does not cap when the effective providers list is unexpectedly empty', async () => {
        const cfg = new WebSearchConfiguration([{ provider: WebSearchProvider.DuckDuckGo }]);
        (cfg as unknown as { providers: unknown[] }).providers = [];
        mockFetch({ ok: true, status: 200, statusText: 'OK', body: '<html></html>' });
        await new WebSearchTool(cfg).execute({ queries: ['q1'] });
        const calls = mockPMap.mock.calls;
        const options = calls[calls.length - 1]![2] as { concurrency: number };
        expect(options.concurrency).toBe(Math.max(1, cfg.concurrency));
    });

