import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProvider, resolveSearchProvider } from '../../../src/lib/search/strategy-resolver.js';
import { DuckDuckGoProvider } from '../../../src/lib/search/duckduckgo.js';
import { TavilyProvider } from '../../../src/lib/search/tavily.js';
import { ExaAIProvider } from '../../../src/lib/search/exaai.js';
import { FirecrawlProvider } from '../../../src/lib/search/firecrawl.js';
import { CompositeSearchProvider } from '../../../src/lib/search/composite.js';
import { WebSearchConfiguration } from '../../../src/lib/config.js';
import { ProviderStrategy, WebSearchProvider } from '../../../src/lib/types.js';

/** Response body compatible with Tavily (content/raw_content) and ExaAI (text) parsers. */
const RESULTS_BODY = JSON.stringify({
    results: [
        {
            title: 'Result 1',
            url: 'https://example.com',
            content: 'Snippet',
            raw_content: 'Raw snippet',
            text: 'Exa text',
            score: 0.9
        }
    ]
});

interface CapturedCall {
    url: string;
    headers: Record<string, string>;
}

/** Spies on global fetch, records url + request headers, returns a JSON success. */
function captureFetch(): CapturedCall[] {
    const calls: CapturedCall[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        calls.push({ url: String(input), headers: Object.fromEntries(new Headers(init?.headers)) });
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(RESULTS_BODY),
            json: () => Promise.resolve(JSON.parse(RESULTS_BODY)),
            headers: new Headers({ 'content-type': 'application/json' }),
            url: String(input)
        } as unknown as Response;
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchImpl as unknown as typeof fetch);
    return calls;
}

describe('createProvider', () => {
    it('returns a DuckDuckGoProvider for DuckDuckGo', () => {
        const provider = createProvider(WebSearchProvider.DuckDuckGo, '', 1000);
        expect(provider).toBeInstanceOf(DuckDuckGoProvider);
    });

    it('returns a TavilyProvider for Tavily', () => {
        const provider = createProvider(WebSearchProvider.Tavily, 'key', 1000);
        expect(provider).toBeInstanceOf(TavilyProvider);
    });

    it('returns an ExaAIProvider for ExaAI', () => {
        const provider = createProvider(WebSearchProvider.ExaAI, 'key', 1000);
        expect(provider).toBeInstanceOf(ExaAIProvider);
    });

    it('returns a FirecrawlProvider for Firecrawl', () => {
        const provider = createProvider(WebSearchProvider.Firecrawl, 'key', 1000);
        expect(provider).toBeInstanceOf(FirecrawlProvider);
    });

    it('throws for unknown provider types', () => {
        expect(() => createProvider('bogus' as WebSearchProvider, '', 1000)).toThrow(
            'Unknown web search provider: bogus'
        );
    });
});

describe('resolveSearchProvider', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns a CompositeSearchProvider for any strategy', () => {
        const cfg = new WebSearchConfiguration(
            [{ provider: WebSearchProvider.DuckDuckGo }],
            ProviderStrategy.Single
        );
        expect(resolveSearchProvider(cfg)).toBeInstanceOf(CompositeSearchProvider);
    });

    it('passes per-provider API keys to each provider instance', async () => {
        const calls = captureFetch();
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'tavily-key' },
                { provider: WebSearchProvider.ExaAI, apiKey: 'exa-key' }
            ],
            ProviderStrategy.Parallel
        );
        await resolveSearchProvider(cfg).search('q', 5, 100);
        const tavilyCall = calls.find((call) => call.url.includes('api.tavily.com'));
        const exaCall = calls.find((call) => call.url.includes('api.exa.ai'));
        expect(tavilyCall!.headers['authorization']).toBe('Bearer tavily-key');
        expect(exaCall!.headers['x-api-key']).toBe('exa-key');
    });

    it('materializes missing entry weights as 1', async () => {
        captureFetch();
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'k1' },
                { provider: WebSearchProvider.DuckDuckGo }
            ],
            ProviderStrategy.WeightedRandom
        );
        // roll = 0.75 * (1 + 1) = 1.5 -> first weight consumed -> second provider.
        vi.spyOn(Math, 'random').mockReturnValue(0.75);
        const calls = captureFetch();
        await resolveSearchProvider(cfg).search('q', 5, 100);
        expect(calls[0]!.url).toContain('duckduckgo');
    });

    it('honors explicit entry weights', async () => {
        captureFetch();
        const cfg = new WebSearchConfiguration(
            [
                { provider: WebSearchProvider.Tavily, apiKey: 'k1', weight: 3 },
                { provider: WebSearchProvider.DuckDuckGo }
            ],
            ProviderStrategy.WeightedRandom
        );
        // roll = 0.5 * 4 = 2 -> consumed by the weight-3 Tavily entry.
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const calls = captureFetch();
        await resolveSearchProvider(cfg).search('q', 5, 100);
        expect(calls[0]!.url).toContain('api.tavily.com');
    });

    it('returns parsed results in Single mode', async () => {
        captureFetch();
        const cfg = new WebSearchConfiguration(
            [{ provider: WebSearchProvider.ExaAI, apiKey: 'k' }],
            ProviderStrategy.Single
        );
        const results = await resolveSearchProvider(cfg).search('q', 5, 100);
        expect(results).toEqual([
            { title: 'Result 1', url: 'https://example.com', content: 'Exa text', score: 0.9 }
        ]);
    });
});
