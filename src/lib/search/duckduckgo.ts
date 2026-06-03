import { SearchProvider } from './base.js';
import type { WebSearchResult } from '../types.js';

/** Search provider that scrapes DuckDuckGo HTML search results (no API key required). */
export class DuckDuckGoProvider extends SearchProvider {
    /**
     * @param timeoutMs Timeout in milliseconds for the HTTP request.
     */
    constructor(timeoutMs: number) {
        super(timeoutMs);
    }

    /**
     * Execute a search by scraping DuckDuckGo's HTML results page.
     *
     * @param query             Search query.
     * @param maxResults        Maximum results to return.
     * @param maxCharsPerResult Max characters per result snippet.
     */
    async search(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]> {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await this.fetchUrl(url, 'DuckDuckGo HTTP');
        const html = await response.text();
        const results: WebSearchResult[] = [];

        const resultRegex =
            /<a\s+rel="nofollow"\s+class="result__a"\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>.*?<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gs;
        let match: RegExpExecArray | null;

        while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
            const rawUrl = match[1]!.replace(/&amp;/g, '&');
            const title = match[2]!.replace(/<[^>]+>/g, '').trim();
            const snippet = match[3]!
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .trim();

            let href = rawUrl;
            const redirectMatch = rawUrl.match(/uddg=([^&]+)/);
            if (redirectMatch) {
                href = decodeURIComponent(redirectMatch[1]!);
            }

            results.push({
                title,
                url: href,
                content: snippet.slice(0, maxCharsPerResult)
            });
        }

        return results;
    }
}
