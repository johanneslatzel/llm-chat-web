/** Supported web search provider backends. */
export enum WebSearchProvider {
    DuckDuckGo = 'duckduckgo',
    Tavily = 'tavily',
    ExaAI = 'exaai'
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
