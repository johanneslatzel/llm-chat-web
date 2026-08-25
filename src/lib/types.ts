/** Supported web search provider backends. */
export enum WebSearchProvider {
    DuckDuckGo = 'duckduckgo',
    Tavily = 'tavily',
    ExaAI = 'exaai',
    Firecrawl = 'firecrawl'
}

/**
 * Strategy describing how multiple configured providers are combined into a
 * single logical search.
 *
 * @property Single        Query one provider only.
 * @property Parallel      Query all providers concurrently and merge results.
 * @property Fallback      Try providers in order until one succeeds.
 * @property WeightedRandom Pick one provider per query via weight distribution.
 * @property RoundRobin    Cycle through providers across consecutive queries.
 */
export enum ProviderStrategy {
    Single = 'single',
    Parallel = 'parallel',
    Fallback = 'fallback',
    WeightedRandom = 'weighted_random',
    RoundRobin = 'round_robin'
}

/**
 * A single result returned by a web search provider.
 *
 * @property title   Result title / headline.
 * @property url     Direct URL to the source page.
 * @property content Snippet or excerpt of the page content.
 * @property score   Relevance score from the provider (optional).
 */
export type WebSearchResult = {
    title: string;
    url: string;
    content: string;
    score?: number;
};

/**
 * One entry of a multi-provider search configuration.
 *
 * @property provider Which search backend to use.
 * @property apiKey   Optional per-provider API key (overrides the global key).
 * @property weight   Optional selection weight used by weighted strategies.
 *                      Consumers default this to 1 when omitted.
 */
export type ProviderEntry = {
    provider: WebSearchProvider;
    apiKey?: string;
    weight?: number;
};

/**
 * Result of fetching and extracting content from a single URL.
 *
 * @property title       Page title.
 * @property url         Final URL (after redirects).
 * @property content     Extracted plain-text content.
 * @property contentType MIME type of the fetched resource.
 */
export type WebFetchResult = {
    title: string;
    url: string;
    content: string;
    contentType: string;
};
