import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchProvider } from '../../../src/lib/search/base.js';
import { CompositeSearchProvider } from '../../../src/lib/search/composite.js';
import type { WeightedProvider } from '../../../src/lib/search/composite.js';
import { ProviderStrategy } from '../../../src/lib/types.js';
import type { WebSearchResult } from '../../../src/lib/types.js';

/** Stub provider returning fixed results or throwing, with call tracking. */
class StubProvider extends SearchProvider {
    calls = 0;

    constructor(private readonly outcome: WebSearchResult[] | Error) {
        super(1000);
    }

    override async search(
        _query: string,
        _maxResults: number,
        _maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        this.calls += 1;
        if (this.outcome instanceof Error) throw this.outcome;
        return this.outcome;
    }
}

function makeResults(urls: string[]): WebSearchResult[] {
    return urls.map((url, index) => ({ title: `Title ${index}`, url, content: `Content ${index}` }));
}

function wp(provider: SearchProvider, weight = 1): WeightedProvider {
    return { provider, weight };
}

describe('CompositeSearchProvider', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Single strategy', () => {
        it('delegates to the one provider', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const composite = new CompositeSearchProvider([wp(a)], ProviderStrategy.Single, 1000);
            await expect(composite.search('q', 5, 100)).resolves.toHaveLength(1);
            expect(a.calls).toBe(1);
        });
    });

    describe('Parallel strategy', () => {
        it('merges results from all providers', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Parallel,
                1000
            );
            const results = await composite.search('q', 5, 100);
            expect(results.map((r) => r.url)).toEqual(['https://a.com', 'https://b.com']);
        });

        it('deduplicates by URL keeping the first occurrence', async () => {
            const a = new StubProvider(makeResults(['https://x.com', 'https://shared.com']));
            const b = new StubProvider(makeResults(['https://shared.com', 'https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Parallel,
                1000
            );
            const results = await composite.search('q', 10, 100);
            expect(results.map((r) => r.url)).toEqual([
                'https://x.com',
                'https://shared.com',
                'https://b.com'
            ]);
        });

        it('trims merged results to maxResults', async () => {
            const a = new StubProvider(makeResults(['https://1.com', 'https://2.com']));
            const b = new StubProvider(makeResults(['https://3.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Parallel,
                1000
            );
            const results = await composite.search('q', 2, 100);
            expect(results.map((r) => r.url)).toEqual(['https://1.com', 'https://2.com']);
        });

        it('tolerates partial failures', async () => {
            const a = new StubProvider(new Error('boom-a'));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Parallel,
                1000
            );
            await expect(composite.search('q', 5, 100)).resolves.toEqual([
                { title: 'Title 0', url: 'https://b.com', content: 'Content 0' }
            ]);
        });

        it('throws the first error when all providers fail', async () => {
            const a = new StubProvider(new Error('boom-a'));
            const b = new StubProvider(new Error('boom-b'));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Parallel,
                1000
            );
            await expect(composite.search('q', 5, 100)).rejects.toThrow('boom-a');
        });
    });

    describe('Fallback strategy', () => {
        it('returns the first successful provider without querying later ones', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Fallback,
                1000
            );
            const results = await composite.search('q', 5, 100);
            expect(results.map((r) => r.url)).toEqual(['https://a.com']);
            expect(b.calls).toBe(0);
        });

        it('skips failed providers and tries the next one', async () => {
            const a = new StubProvider(new Error('boom-a'));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Fallback,
                1000
            );
            const results = await composite.search('q', 5, 100);
            expect(results.map((r) => r.url)).toEqual(['https://b.com']);
            expect(a.calls).toBe(1);
            expect(b.calls).toBe(1);
        });

        it('throws the last error when all providers fail', async () => {
            const a = new StubProvider(new Error('boom-a'));
            const b = new StubProvider(new Error('boom-b'));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.Fallback,
                1000
            );
            await expect(composite.search('q', 5, 100)).rejects.toThrow('boom-b');
        });
    });

    describe('WeightedRandom strategy', () => {
        it('selects according to the cumulative weight distribution', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a, 3), wp(b, 1)],
                ProviderStrategy.WeightedRandom,
                1000
            );
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
            await composite.search('q', 5, 100);
            expect(a.calls).toBe(1);
            expect(b.calls).toBe(0);
        });

        it('falls through to the last provider at the upper distribution bound', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a, 3), wp(b, 1)],
                ProviderStrategy.WeightedRandom,
                1000
            );
            vi.spyOn(Math, 'random').mockReturnValue(1);
            await composite.search('q', 5, 100);
            expect(a.calls).toBe(0);
            expect(b.calls).toBe(1);
        });
    });

    describe('RoundRobin strategy', () => {
        it('cycles through providers in order and wraps around', async () => {
            const a = new StubProvider(makeResults(['https://a.com']));
            const b = new StubProvider(makeResults(['https://b.com']));
            const composite = new CompositeSearchProvider(
                [wp(a), wp(b)],
                ProviderStrategy.RoundRobin,
                1000
            );
            await composite.search('q', 5, 100);
            await composite.search('q', 5, 100);
            await composite.search('q', 5, 100);
            expect(a.calls).toBe(2);
            expect(b.calls).toBe(1);
        });
    });
});
