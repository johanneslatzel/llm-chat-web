import { SearchProvider } from './base.js';
import { DuckDuckGoProvider } from './duckduckgo.js';
import { TavilyProvider } from './tavily.js';
import { ExaAIProvider } from './exaai.js';
import { FirecrawlProvider } from './firecrawl.js';
import { CompositeSearchProvider } from './composite.js';
import type { WeightedProvider } from './composite.js';
import type { WebSearchConfiguration } from '../config.js';
import { WebSearchProvider } from '../types.js';
import type { ProviderEntry } from '../types.js';

/**
 * Creates a single search provider instance for the given backend.
 *
 * @param provider  Which search backend to instantiate.
 * @param apiKey    API key for paid backends (ignored by keyless backends).
 * @param timeoutMs Timeout in milliseconds for API requests.
 * @returns The configured SearchProvider instance.
 * @throws When the provider value is not a known backend.
 */
export function createProvider(
    provider: WebSearchProvider,
    apiKey: string,
    timeoutMs: number
): SearchProvider {
    switch (provider) {
        case WebSearchProvider.DuckDuckGo:
            return new DuckDuckGoProvider(timeoutMs);
        case WebSearchProvider.Tavily:
            return new TavilyProvider(apiKey, timeoutMs);
        case WebSearchProvider.ExaAI:
            return new ExaAIProvider(apiKey, timeoutMs);
        case WebSearchProvider.Firecrawl:
            return new FirecrawlProvider(apiKey, timeoutMs);
        default:
            throw new Error('Unknown web search provider: ' + String(provider));
    }
}

/**
 * Builds the SearchProvider described by a configuration.
 *
 * Maps every configured {@link ProviderEntry} to a concrete provider instance
 * and wraps them in a CompositeSearchProvider applying the configured
 * strategy. Missing entry weights are materialized as 1, as type declarations
 * cannot express defaults.
 *
 * @param config Search configuration (providers, strategy, timeout).
 */
export function resolveSearchProvider(config: WebSearchConfiguration): SearchProvider {
    const weightedProviders: WeightedProvider[] = config.providers.map((entry: ProviderEntry) => ({
        provider: createProvider(entry.provider, entry.apiKey ?? '', config.searchTimeoutMs),
        weight: entry.weight ?? 1
    }));
    return new CompositeSearchProvider(weightedProviders, config.strategy, config.searchTimeoutMs);
}
