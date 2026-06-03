import { ApiKeySearchProvider } from './base.js';
import type { WebSearchResult } from '../types.js';

/** Search provider backed by the Tavily API (https://tavily.com). */
export class TavilyProvider extends ApiKeySearchProvider {
    /**
     * @param apiKey    Tavily API key.
     * @param timeoutMs Timeout in milliseconds for API requests.
     */
    constructor(apiKey: string, timeoutMs: number) {
        super(apiKey, timeoutMs);
    }

    /**
     * Execute a search via the Tavily `/search` endpoint.
     *
     * @param query             Search query.
     * @param maxResults        Maximum results to return (capped at 20).
     * @param maxCharsPerResult Max characters per result snippet.
     */
    async search(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        const response = await this.postJson('https://api.tavily.com/search', 'Tavily API', {
            query,
            search_depth: 'basic',
            max_results: Math.min(maxResults, 20),
            include_answer: false,
            include_raw_content: true
        });

        const data = (await response.json()) as {
            results: Array<{
                title: string;
                url: string;
                content: string;
                raw_content?: string;
                score: number;
            }>;
        };

        return data.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: (r.raw_content || r.content).slice(0, maxCharsPerResult),
            score: r.score
        }));
    }
}
