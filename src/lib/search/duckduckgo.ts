import { SearchProvider } from './base.js';
import type { WebSearchResult } from '../types.js';

/** Maximum number of retry attempts after a challenge page or 403/429 response. */
const MAX_RETRIES = 2;

/** Base delay in ms for the first retry (doubles on each subsequent retry). */
const RETRY_BASE_DELAY_MS = 500;

/** Structural markers that indicate a DuckDuckGo anti-bot challenge page. */
const CHALLENGE_MARKERS = [
    'challenge-form',
    'bots use DuckDuckGo',
    'challenge-lite',
    'error-lite+',
    'anomaly',
    'Unfortunately, bots use DuckDuckGo too'
];

/**
 * Detect whether the HTML response is an anti-bot challenge page.
 *
 * Uses structural markers rather than single keywords to avoid false positives
 * on normal result pages that may contain the word "challenge" in snippets.
 *
 * @param html The raw HTML response body.
 * @returns `true` if the page is a challenge page.
 */
function isChallengePage(html: string): boolean {
    return CHALLENGE_MARKERS.some((marker) => html.includes(marker));
}

/**
 * Returns `true` when the error indicates a retryable HTTP status.
 *
 * @param error The caught error from fetchUrl.
 */
function isRetryableError(error: Error): boolean {
    const msg = error.message;
    return msg.includes('(403)') || msg.includes('(429)');
}

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
     * Retries on anti-bot challenge pages and HTTP 403/429 responses with
     * exponential backoff (max 2 retries). Concurrency is capped at 1 for
     * DuckDuckGo to reduce IP-level throttling.
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
        return this.executeWithRetry(query, maxResults, maxCharsPerResult, 0);
    }

    /**
     * Execute the search with retry logic for challenge pages and HTTP 403/429.
     *
     * @param query             Search query.
     * @param maxResults        Maximum results to return.
     * @param maxCharsPerResult Max characters per result snippet.
     * @param attempt           Current attempt number (0-indexed).
     */
    private async executeWithRetry(
        query: string,
        maxResults: number,
        maxCharsPerResult: number,
        attempt: number
    ): Promise<WebSearchResult[]> {
        try {
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await this.fetchUrl(url, 'DuckDuckGo HTTP');
            const html = await response.text();

            if (isChallengePage(html)) {
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                    await this.sleep(delay);
                    return this.executeWithRetry(query, maxResults, maxCharsPerResult, attempt + 1);
                }
                throw new Error(
                    'DuckDuckGo blocked this request (anti-bot challenge); retry later or switch provider'
                );
            }

            return this.parseResults(html, maxResults, maxCharsPerResult);
        } catch (error) {
            if (isRetryableError(error as Error) && attempt < MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                await this.sleep(delay);
                return this.executeWithRetry(query, maxResults, maxCharsPerResult, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Parse DuckDuckGo HTML results into structured search results.
     *
     * @param html              Raw HTML response body.
     * @param maxResults        Maximum results to return.
     * @param maxCharsPerResult Max characters per result snippet.
     * @returns Parsed search results.
     */
    private parseResults(
        html: string,
        maxResults: number,
        maxCharsPerResult: number
    ): WebSearchResult[] {
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

    /**
     * Sleep for the given duration. Used for retry backoff.
     *
     * @param ms Milliseconds to sleep.
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
