import { WebFetchConfiguration } from '../lib/config.js';
import { fetchWithTimeout, getContentLength } from '../lib/http.js';
import { FetchRegistry } from '../lib/fetch-registry.js';
import {
    PropertyType,
    ResultBuilder,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import pMap from 'p-map';

/** Tool that fetches one or more URLs and returns their content as clean text. */
export class WebFetchTool extends Tool {
    private readonly config: WebFetchConfiguration;
    private readonly registry: FetchRegistry;

    /**
     * @param config   Fetch configuration (timeout, size limits, etc.).
     * @param registry Optional custom content handler registry. Defaults to the built-in registry.
     */
    constructor(config: WebFetchConfiguration, registry?: FetchRegistry) {
        super(
            'web_fetch',
            'Fetches one or more URLs in parallel and returns their content as clean text. Pass an array of URLs ("urls"). Use this when you need to read web pages, JSON APIs, XML feeds, or other text-based content.',
            new ToolParameters(
                {
                    urls: new ToolParameterProperty('Array of URLs to fetch', PropertyType.Array),
                    max_chars: new ToolParameterProperty(
                        'Maximum characters to return per URL (default: 10000, max: 100000)',
                        PropertyType.Number
                    )
                },
                ['urls']
            )
        );
        this.config = config;
        this.registry = registry ?? new FetchRegistry();
        this.registry.init();
    }

    /**
     * Execute the fetch for one or more URLs.
     *
     * @param args.urls       The array of URLs to fetch (required).
     * @param args.max_chars  Max characters to return per URL (default: config default, max: config limit).
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const rawUrls = args.urls;
        if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
            return {
                result: "'urls' must be a non-empty array of strings",
                status: ResultStatus.Error
            };
        }

        const maxChars =
            typeof args.max_chars === 'number'
                ? Math.max(
                      1,
                      Math.min(Math.floor(args.max_chars), this.config.maxCharsPerFetchLimit)
                  )
                : this.config.maxCharsPerFetch;

        const concurrency = Math.max(1, this.config.concurrency);

        const promises = rawUrls.map((u) => () => this.fetchSingleUrl(u, maxChars));

        try {
            const results = await pMap(promises, (fn) => fn(), {
                concurrency,
                stopOnError: false
            });
            return ResultBuilder.from(results).build();
        } catch (e) {
            return {
                result: `Web fetch error: ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }
    }

    /**
     * Fetch a single URL and return a PartialToolResult.
     *
     * @param url      The URL to fetch.
     * @param maxChars Max characters to return.
     * @returns A PartialToolResult with the fetched content or an error.
     */
    private async fetchSingleUrl(url: unknown, maxChars: number): Promise<PartialToolResult> {
        if (typeof url !== 'string' || !url.trim()) {
            return {
                result: 'URL must be a non-empty string',
                status: ResultStatus.Error
            };
        }

        const trimmedUrl = url.trim();

        try {
            const contentLength = await getContentLength(trimmedUrl, {
                timeout: this.config.fetchTimeoutMs
            });

            if (contentLength !== undefined && contentLength > this.config.maxContentLengthBytes) {
                return {
                    result: `${trimmedUrl}: Content too large: ${contentLength} bytes exceeds limit of ${this.config.maxContentLengthBytes} bytes`,
                    status: ResultStatus.Error
                };
            }

            const response = await fetchWithTimeout(trimmedUrl, {
                timeout: this.config.fetchTimeoutMs
            });

            if (!response.ok) {
                return {
                    result: `${trimmedUrl}: HTTP error ${response.status}: ${response.statusText}`,
                    status: ResultStatus.Error
                };
            }

            const contentType = response.headers.get('content-type') || 'text/plain';

            const handler = this.registry.getHandler(contentType);
            if (!handler) {
                return {
                    result: `${trimmedUrl}: Unsupported content type: ${contentType}`,
                    status: ResultStatus.Error
                };
            }

            const body = await response.text();

            return await handler.handle(body, trimmedUrl, response.url || trimmedUrl, maxChars);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown fetch error';
            return {
                result: `${trimmedUrl}: Web fetch error: ${message}`,
                status: ResultStatus.Error
            };
        }
    }
}
