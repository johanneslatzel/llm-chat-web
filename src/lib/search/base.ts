import { DEFAULT_USER_AGENT } from '../config.js';
import type { WebSearchResult } from '../types.js';

/** Abstract base for all web search provider implementations. */
export abstract class SearchProvider {
    private readonly timeoutMs: number;

    /**
     * @param timeoutMs Timeout in milliseconds for each HTTP request made by this provider.
     */
    constructor(timeoutMs: number) {
        this.timeoutMs = timeoutMs;
    }

    /** Default headers sent with every request (User-Agent only). */
    protected get headers(): Record<string, string> {
        return { 'User-Agent': DEFAULT_USER_AGENT };
    }

    /**
     * Perform an HTTP fetch with a timeout and basic error handling.
     *
     * @param url   Fully qualified URL.
     * @param label Human-readable label used in error messages (e.g. "Tavily API").
     * @param init  Additional fetch options (method, body, etc.).
     * @throws When the response status is not OK.
     */
    protected async fetchUrl(url: string, label: string, init?: RequestInit): Promise<Response> {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(this.timeoutMs),
            headers: this.headers,
            ...init
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`${label} error (${response.status}): ${body}`);
        }
        return response;
    }

    /**
     * Execute a search and return structured results.
     *
     * @param query             Search query string.
     * @param maxResults        Maximum number of results to return.
     * @param maxCharsPerResult Maximum characters to include per result snippet.
     */
    abstract search(
        query: string,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<WebSearchResult[]>;
}

/** Abstract base for search providers that require an API key (Tavily, ExaAI). */
export abstract class ApiKeySearchProvider extends SearchProvider {
    protected readonly apiKey: string;

    /**
     * @param apiKey    Provider API key.
     * @param timeoutMs Timeout in milliseconds for API requests.
     */
    constructor(apiKey: string, timeoutMs: number) {
        super(timeoutMs);
        this.apiKey = apiKey;
    }

    /** Headers including Content-Type and Bearer auth. */
    protected override get headers(): Record<string, string> {
        return {
            ...super.headers,
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    /**
     * Convenience method for POST requests with a JSON body.
     *
     * @param url   API endpoint URL.
     * @param label Human-readable label for error messages.
     * @param body  JSON-serializable payload.
     */
    protected postJson(
        url: string,
        label: string,
        body: Record<string, unknown>
    ): Promise<Response> {
        return this.fetchUrl(url, label, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
}
