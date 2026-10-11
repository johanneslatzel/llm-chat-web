import { ProviderStrategy, WebSearchProvider } from './types.js';
import type { ProviderEntry } from './types.js';
import type { HeaderRule } from './header-rules.js';
import { envInt, envString, envEnum } from './env.js';

const MAX_CHARS_PER_FETCH_DEFAULT = 10_000;
const MAX_CHARS_PER_FETCH_LIMIT = 100_000;
const MAX_CONTENT_LENGTH_BYTES_DEFAULT = 10_000_000;
const MAX_PDF_PAGES_DEFAULT = 100;
/** Default timeout (ms) for individual HTTP fetch requests. */
export const FETCH_TIMEOUT_DEFAULT_MS = 5_000;
/** Default timeout (ms) for search provider API calls. */
export const SEARCH_TIMEOUT_DEFAULT_MS = 4_000;
/** User-Agent header value sent with all outgoing HTTP requests. */
export const DEFAULT_USER_AGENT = 'llm-chat-web';
const CONCURRENCY_DEFAULT = 3;

/** Configuration for the web search tool.
 *
 * Each property can be set at construction time or overridden via environment
 * variables (see individual field docs for the env-var name).
 *
 * @property providers        Multi-provider entries describing the active backends.
 *                             Taken from constructor args or resolved from
 *                             `LLM_CHAT_WEB_SEARCH_PROVIDERS`. Zero-config resolves
 *                             to a single keyless DuckDuckGo entry.
 * @property strategy         How multiple providers are combined
 *                             (env: `LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY`, default: single).
 * @property maxResults       Max results returned per query (env: `LLM_CHAT_WEB_SEARCH_MAX_RESULTS`).
 * @property maxCharsPerResult Max characters per result snippet (env: `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT`).
 * @property searchTimeoutMs  Timeout per search-API call in ms (env: `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS`).
 * @property concurrency      Max concurrent search queries (env: `LLM_CHAT_WEB_SEARCH_CONCURRENCY`).
 */
export class WebSearchConfiguration {
    /** Max results returned per query (env: `LLM_CHAT_WEB_SEARCH_MAX_RESULTS`). */
    maxResults: number = envInt('LLM_CHAT_WEB_SEARCH_MAX_RESULTS', 5);
    /** Max characters per result snippet (env: `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT`). */
    maxCharsPerResult: number = envInt('LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT', 2000);
    /** Timeout per search-API call in ms (env: `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS`). */
    searchTimeoutMs: number = envInt('LLM_CHAT_WEB_SEARCH_TIMEOUT_MS', SEARCH_TIMEOUT_DEFAULT_MS);
    /** Max concurrent search queries (env: `LLM_CHAT_WEB_SEARCH_CONCURRENCY`). */
    concurrency: number = envInt('LLM_CHAT_WEB_SEARCH_CONCURRENCY', CONCURRENCY_DEFAULT);
    /** How multiple configured providers are combined (env: `LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY`). */
    strategy: ProviderStrategy = envEnum(
        'LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY',
        Object.values(ProviderStrategy) as ProviderStrategy[],
        ProviderStrategy.Single
    );
    /** Provider entries describing the active search backends. Always non-empty after construction. */
    providers: ProviderEntry[] = [];

    /**
     * Creates a web search configuration.
     *
     * @param providers Provider entries to combine. When omitted or empty, entries are
     *                  resolved from `LLM_CHAT_WEB_SEARCH_PROVIDERS`; unknown names are
     *                  skipped, and when nothing valid remains a single keyless
     *                  DuckDuckGo entry keeps zero-config setups working.
     * @param strategy  Strategy used to combine the providers. If omitted,
     *                  resolved from `LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY` (default: single).
     */
    constructor(providers?: ProviderEntry[], strategy?: ProviderStrategy) {
        this.providers =
            providers !== undefined && providers.length > 0
                ? [...providers]
                : this.resolveProvidersFromEnv();
        if (strategy !== undefined) {
            this.strategy = strategy;
        }
    }

    /**
     * Builds the provider entries from `LLM_CHAT_WEB_SEARCH_PROVIDERS`.
     * Each name maps to a `ProviderEntry`; its API key comes from the backend's
     * dedicated env var. Unknown names are skipped. Falls back to a single
     * keyless DuckDuckGo entry when no valid name remains.
     */
    private resolveProvidersFromEnv(): ProviderEntry[] {
        const raw = process.env['LLM_CHAT_WEB_SEARCH_PROVIDERS'];
        const names =
            raw === undefined
                ? []
                : raw
                      .split(',')
                      .map((name) => name.trim())
                      .filter((name) => name !== '');
        const entries: ProviderEntry[] = [];
        for (const name of names) {
            const entry = this.entryForName(name);
            if (entry !== undefined) entries.push(entry);
        }
        return entries.length === 0 ? [{ provider: WebSearchProvider.DuckDuckGo }] : entries;
    }

    /** Builds a ProviderEntry, omitting the apiKey property when absent. */
    private makeEntry(provider: WebSearchProvider, apiKey?: string): ProviderEntry {
        return apiKey === undefined || apiKey === '' ? { provider } : { provider, apiKey };
    }

    /**
     * Maps a provider name from `LLM_CHAT_WEB_SEARCH_PROVIDERS` to an entry.
     * Returns undefined for unknown names so invalid entries are skipped
     * instead of being silently mapped to another backend.
     */
    private entryForName(name: string): ProviderEntry | undefined {
        const provider = Object.values(WebSearchProvider).find((candidate) => candidate === name);
        if (provider === undefined) return undefined;
        return this.makeEntry(provider, this.resolveApiKey(provider));
    }

    /** Per-provider API key from its dedicated env var, or undefined when unset. */
    private resolveApiKey(provider: WebSearchProvider): string | undefined {
        let key: string;
        switch (provider) {
            case WebSearchProvider.Tavily:
                key = envString('LLM_CHAT_WEB_SEARCH_TAVILY_API_KEY', '');
                break;
            case WebSearchProvider.ExaAI:
                key = envString('LLM_CHAT_WEB_SEARCH_EXAAI_API_KEY', '');
                break;
            case WebSearchProvider.Firecrawl:
                key = envString('LLM_CHAT_WEB_SEARCH_FIRECRAWL_API_KEY', '');
                break;
            case WebSearchProvider.DuckDuckGo:
                key = '';
                break;
        }
        return key || undefined;
    }
}

/** Configuration for the single-URL fetch tool. */
export class WebFetchConfiguration {
    /** Default max chars returned per fetch (env: `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH`). */
    maxCharsPerFetch: number = envInt(
        'LLM_CHAT_WEB_MAX_CHARS_PER_FETCH',
        MAX_CHARS_PER_FETCH_DEFAULT
    );
    /** Hard upper limit a caller may request (env: `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT`). */
    maxCharsPerFetchLimit: number = envInt(
        'LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT',
        MAX_CHARS_PER_FETCH_LIMIT
    );
    /** Timeout per individual fetch in ms (env: `LLM_CHAT_WEB_FETCH_TIMEOUT_MS`). */
    fetchTimeoutMs: number = envInt('LLM_CHAT_WEB_FETCH_TIMEOUT_MS', FETCH_TIMEOUT_DEFAULT_MS);
    /** Maximum allowed response body length before rejection (env: `LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES`). */
    maxContentLengthBytes: number = envInt(
        'LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES',
        MAX_CONTENT_LENGTH_BYTES_DEFAULT
    );
    /** Max concurrent fetch requests (env: `LLM_CHAT_WEB_FETCH_CONCURRENCY`). */
    concurrency: number = envInt('LLM_CHAT_WEB_FETCH_CONCURRENCY', CONCURRENCY_DEFAULT);
    /** Default max pages extracted from a PDF (env: `LLM_CHAT_WEB_MAX_PDF_PAGES`). */
    maxPdfPages: number = envInt('LLM_CHAT_WEB_MAX_PDF_PAGES', MAX_PDF_PAGES_DEFAULT);
    /** Host-controlled header rules applied to matching URLs (config only, no env var). */
    headerRules: HeaderRule[] = [];
}
