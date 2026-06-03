import { ApiKeySearchProvider } from './base.js';
import type { WebSearchResult } from '../types.js';

/** Search provider backed by the ExaAI API (https://exa.ai). */
export class ExaAIProvider extends ApiKeySearchProvider {
    /**
     * @param apiKey    ExaAI API key.
     * @param timeoutMs Timeout in milliseconds for API requests.
     */
    constructor(apiKey: string, timeoutMs: number) {
        super(apiKey, timeoutMs);
    }

    /** Uses `x-api-key` header (ExaAI's auth scheme) instead of Bearer. */
    protected override get headers(): Record<string, string> {
        return {
            ...super.headers,
            'x-api-key': this.apiKey
        };
    }

    /**
     * Execute a search via the ExaAI `/search` endpoint.
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
        const response = await this.postJson('https://api.exa.ai/search', 'ExaAI API', {
            query,
            numResults: Math.min(maxResults, 20),
            type: 'auto',
            contents: { text: true }
        });

        const data = (await response.json()) as {
            results: Array<{
                title: string;
                url: string;
                text?: string;
                score: number;
            }>;
        };

        return data.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: (r.text || '').slice(0, maxCharsPerResult),
            score: r.score
        }));
    }
}
