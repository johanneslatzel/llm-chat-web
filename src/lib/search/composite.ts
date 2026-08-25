import { SearchProvider } from './base.js';
import { ProviderStrategy } from '../types.js';
import type { WebSearchResult } from '../types.js';

/** A search provider paired with the selection weight used by weighted strategies. */
export type WeightedProvider = {
    /** The wrapped search provider. */
    provider: SearchProvider;
    /** Relative selection weight; only meaningful for WeightedRandom. */
    weight: number;
};

/**
 * Search provider that combines multiple underlying providers according to a
 * {@link ProviderStrategy}.
 */
export class CompositeSearchProvider extends SearchProvider {
    private readonly weightedProviders: WeightedProvider[];
    private readonly strategy: ProviderStrategy;
    private roundRobinIndex = 0;

    /**
     * @param weightedProviders Providers to combine (non-empty).
     * @param strategy          Strategy describing how the providers are combined.
     * @param timeoutMs         Timeout in milliseconds for underlying provider requests.
     */
    constructor(
        weightedProviders: WeightedProvider[],
        strategy: ProviderStrategy,
        timeoutMs: number
    ) {
        super(timeoutMs);
        this.weightedProviders = weightedProviders;
        this.strategy = strategy;
    }

    /**
     * Execute the query according to the configured strategy.
     *
     * @param query             Search query string.
     * @param maxResults        Maximum number of results to return.
     * @param maxCharsPerResult Maximum characters per result snippet.
     */
    async search(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        switch (this.strategy) {
            case ProviderStrategy.Parallel:
                return this.searchParallel(query, maxResults, maxCharsPerResult);
            case ProviderStrategy.Fallback:
                return this.searchFallback(query, maxResults, maxCharsPerResult);
            case ProviderStrategy.WeightedRandom:
                return this.selectByWeight().search(query, maxResults, maxCharsPerResult);
            case ProviderStrategy.RoundRobin:
                return this.selectRoundRobin().search(query, maxResults, maxCharsPerResult);
            case ProviderStrategy.Single:
                return this.searchSingle(query, maxResults, maxCharsPerResult);
        }
    }

    /** Delegates the query to the first configured provider. */
    private searchSingle(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        return this.weightedProviders[0]!.provider.search(query, maxResults, maxCharsPerResult);
    }

    /**
     * Queries all providers concurrently and merges their results.
     *
     * Tolerates partial failures: results from successful providers are kept.
     * Throws the first error when every provider fails.
     */
    private async searchParallel(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        const settled = await Promise.allSettled(
            this.weightedProviders.map((entry) =>
                entry.provider.search(query, maxResults, maxCharsPerResult)
            )
        );
        if (settled.every((outcome) => outcome.status === 'rejected')) {
            throw (settled[0] as PromiseRejectedResult).reason;
        }
        const results = settled.flatMap((outcome) =>
            outcome.status === 'fulfilled' ? outcome.value : []
        );
        return this.deduplicateByUrl(results).slice(0, maxResults);
    }

    /**
     * Tries providers sequentially and returns the first successful result.
     *
     * @throws The last provider's error when every provider fails.
     */
    private async searchFallback(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        let lastError: unknown = undefined;
        for (const entry of this.weightedProviders) {
            try {
                return await entry.provider.search(query, maxResults, maxCharsPerResult);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    /** Picks one provider via cumulative weight distribution and delegates. */
    private selectByWeight(): SearchProvider {
        const total = this.weightedProviders.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * total;
        for (const entry of this.weightedProviders) {
            roll -= entry.weight;
            if (roll < 0) return entry.provider;
        }
        return this.weightedProviders[this.weightedProviders.length - 1]!.provider;
    }

    /** Picks providers cyclically across consecutive queries (wraps around). */
    private selectRoundRobin(): SearchProvider {
        const entry = this.weightedProviders[this.roundRobinIndex % this.weightedProviders.length]!;
        this.roundRobinIndex += 1;
        return entry.provider;
    }

    /**
     * Removes duplicate URLs, keeping the first occurrence of each URL.
     */
    private deduplicateByUrl(results: WebSearchResult[]): WebSearchResult[] {
        const seenUrls = new Set<string>();
        return results.filter((result) => {
            if (seenUrls.has(result.url)) return false;
            seenUrls.add(result.url);
            return true;
        });
    }
}
