import { ApiKeySearchProvider } from './base.js';
import type { WebSearchResult } from '../types.js';

/** Search provider backed by the Firecrawl API (https://firecrawl.dev). */
export class FirecrawlProvider extends ApiKeySearchProvider {
    /**
     * @param apiKey    Firecrawl API key (prefix: fc-).
     * @param timeoutMs Timeout in milliseconds for API requests.
     */
    constructor(apiKey: string, timeoutMs: number) {
        super(apiKey, timeoutMs);
    }

    /**
     * Execute a search via the Firecrawl `/v2/search` endpoint.
     *
     * @param query             Search query.
     * @param maxResults        Maximum results to return (capped at 100).
     * @param maxCharsPerResult Max characters per result snippet.
     */
    async search(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        const response = await this.postJson(
            'https://api.firecrawl.dev/v2/search',
            'Firecrawl API',
            {
                query,
                limit: Math.min(maxResults, 100),
                sources: [{ type: 'web' }]
            }
        );

        const data = (await response.json()) as {
            success: boolean;
            data?: {
                web?: Array<{
                    title: string;
                    description: string;
                    url: string;
                }>;
            };
            warning?: string;
        };

        const innerData = data.data;
        let webResults: Array<{ title: string; description: string; url: string }> = [];
        if (innerData != null) {
            if (innerData.web != null) {
                webResults = innerData.web;
            }
        }

        return webResults.map((r) => ({
            title: r.title,
            url: r.url,
            content: (r.description || '').slice(0, maxCharsPerResult)
        }));
    }
}
