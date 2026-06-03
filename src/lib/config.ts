import { WebSearchProvider } from './types.js';

const MAX_CHARS_PER_FETCH_DEFAULT = 10_000;
const MAX_CHARS_PER_FETCH_LIMIT = 100_000;
const MAX_CONTENT_LENGTH_BYTES_DEFAULT = 10_000_000;
/** Default timeout (ms) for individual HTTP fetch requests. */
export const FETCH_TIMEOUT_DEFAULT_MS = 5_000;
/** Default timeout (ms) for search provider API calls. */
export const SEARCH_TIMEOUT_DEFAULT_MS = 4_000;
/** User-Agent header value sent with all outgoing HTTP requests. */
export const DEFAULT_USER_AGENT = 'llm-chat-web';
const BATCH_FETCH_CONCURRENCY_DEFAULT = 3;
const BATCH_FETCH_MAX_CONCURRENCY_DEFAULT = 10;

/** Configuration for the web search tool.
 *
 * Each property can be set at construction time or overridden via environment
 * variables (see individual field docs for the env-var name).
 *
 * @property apiKey           API key for paid search providers (Tavily, ExaAI).
 *                             Falls back to `LLM_CHAT_WEB_SEARCH_API_KEY`.
 * @property provider         Which search backend to use.
 *                             Falls back to `LLM_CHAT_WEB_SEARCH_PROVIDER`.
 * @property maxResults       Max results returned per query (env: `LLM_CHAT_WEB_SEARCH_MAX_RESULTS`).
 * @property maxCharsPerResult Max characters per result snippet (env: `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT`).
 * @property searchTimeoutMs  Timeout per search-API call in ms (env: `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS`).
 */
export class WebSearchConfiguration {
    apiKey: string;
    provider: WebSearchProvider;
    maxResults: number = parseInt(process.env.LLM_CHAT_WEB_SEARCH_MAX_RESULTS ?? '', 10) || 5;
    maxCharsPerResult: number =
        parseInt(process.env.LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT ?? '', 10) || 2000;
    searchTimeoutMs: number =
        parseInt(process.env.LLM_CHAT_WEB_SEARCH_TIMEOUT_MS ?? '', 10) || SEARCH_TIMEOUT_DEFAULT_MS;

    /**
     * @param provider Search provider to use. If omitted, resolved from
     *                 `LLM_CHAT_WEB_SEARCH_PROVIDER` env var (default: DuckDuckGo).
     * @param apiKey   API key for paid providers. If omitted, falls back to
     *                 `LLM_CHAT_WEB_SEARCH_API_KEY` env var.
     */
    constructor(provider?: WebSearchProvider, apiKey?: string) {
        if (apiKey !== undefined) {
            this.apiKey = apiKey;
        } else {
            this.apiKey = process.env.LLM_CHAT_WEB_SEARCH_API_KEY ?? '';
        }
        if (provider !== undefined) {
            this.provider = provider;
        } else {
            const envProvider = (process.env.LLM_CHAT_WEB_SEARCH_PROVIDER || '').toLowerCase();
            if (envProvider === 'tavily') {
                this.provider = WebSearchProvider.Tavily;
            } else if (envProvider === 'exaai') {
                this.provider = WebSearchProvider.ExaAI;
            } else {
                this.provider = WebSearchProvider.DuckDuckGo;
            }
        }
    }
}

/** Configuration for the single-URL fetch tool.
 *
 * @property maxCharsPerFetch      Default max chars returned per fetch (env: `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH`).
 * @property maxCharsPerFetchLimit Hard upper limit a caller may request (env: `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT`).
 * @property fetchTimeoutMs        Timeout per individual fetch in ms (env: `LLM_CHAT_WEB_FETCH_TIMEOUT_MS`).
 * @property maxContentLengthBytes Maximum allowed response body length before rejection (env: `LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES`).
 */
export class WebFetchConfiguration {
    maxCharsPerFetch: number =
        parseInt(process.env.LLM_CHAT_WEB_MAX_CHARS_PER_FETCH ?? '', 10) ||
        MAX_CHARS_PER_FETCH_DEFAULT;
    maxCharsPerFetchLimit: number =
        parseInt(process.env.LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT ?? '', 10) ||
        MAX_CHARS_PER_FETCH_LIMIT;
    fetchTimeoutMs: number =
        parseInt(process.env.LLM_CHAT_WEB_FETCH_TIMEOUT_MS ?? '', 10) || FETCH_TIMEOUT_DEFAULT_MS;
    maxContentLengthBytes: number =
        parseInt(process.env.LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES ?? '', 10) ||
        MAX_CONTENT_LENGTH_BYTES_DEFAULT;
}

/** Configuration for the batch-URL fetch tool.
 *
 * @property fetchConfig    Underlying single-fetch configuration.
 * @property concurrency    Max concurrent fetches (env: `LLM_CHAT_WEB_BATCH_FETCH_CONCURRENCY`).
 * @property maxConcurrency Hard upper limit a caller may request (env: `LLM_CHAT_WEB_BATCH_FETCH_MAX_CONCURRENCY`).
 */
export class BatchWebFetchConfiguration {
    fetchConfig: WebFetchConfiguration;
    concurrency: number =
        parseInt(process.env.LLM_CHAT_WEB_BATCH_FETCH_CONCURRENCY ?? '', 10) ||
        BATCH_FETCH_CONCURRENCY_DEFAULT;
    maxConcurrency: number =
        parseInt(process.env.LLM_CHAT_WEB_BATCH_FETCH_MAX_CONCURRENCY ?? '', 10) ||
        BATCH_FETCH_MAX_CONCURRENCY_DEFAULT;

    /**
     * @param fetchConfig Single-fetch configuration. Defaults to a fresh `WebFetchConfiguration`.
     */
    constructor(fetchConfig?: WebFetchConfiguration) {
        this.fetchConfig = fetchConfig ?? new WebFetchConfiguration();
    }
}
