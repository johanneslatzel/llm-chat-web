import { WebFetchConfiguration } from '../lib/config.js';
import { fetchWithTimeout, getContentLength } from '../lib/http.js';
import { extractText } from '../lib/extract.js';
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

/**
 * Truncate extracted (non-raw) text at a natural boundary (paragraph, sentence, or word).
 *
 * @param text     The text to truncate.
 * @param maxChars Maximum allowed characters.
 * @returns Truncated text with a "[truncated]" marker appended.
 */
function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;

    const marker = '... [truncated]';
    const budget = maxChars - marker.length;
    if (budget <= 0) return marker;

    const before = text.slice(0, budget);

    const lastPara = before.lastIndexOf('\n\n');
    if (lastPara > budget * 0.5) {
        return before.slice(0, lastPara) + '\n\n' + marker;
    }

    const lastSentence = before.lastIndexOf('. ');
    if (lastSentence > budget * 0.3) {
        return before.slice(0, lastSentence + 1) + ' ' + marker;
    }

    const lastSpace = before.lastIndexOf(' ');
    if (lastSpace > 0) {
        return before.slice(0, lastSpace) + ' ' + marker;
    }

    return before + marker;
}

/** Tool that fetches one or more URLs and returns their content as extracted plain text (or raw). */
export class WebFetchTool extends Tool {
    private readonly config: WebFetchConfiguration;

    /**
     * @param config Fetch configuration (timeout, size limits, etc.).
     */
    constructor(config: WebFetchConfiguration) {
        super(
            'web_fetch',
            'Fetches one or more URLs in parallel and returns their content as clean text. Pass an array of URLs ("urls"). Use this when you need to read the full content of web pages, articles, or documentation.',
            new ToolParameters(
                {
                    urls: new ToolParameterProperty('Array of URLs to fetch', PropertyType.Array),
                    max_chars: new ToolParameterProperty(
                        'Maximum characters to return per URL (default: 10000, max: 100000)',
                        PropertyType.Number
                    ),
                    raw: new ToolParameterProperty(
                        'If true, return raw response instead of extracted text for each URL (e.g. json, xml or source code response expected)',
                        PropertyType.Boolean
                    )
                },
                ['urls']
            )
        );
        this.config = config;
    }

    /**
     * Execute the fetch for one or more URLs.
     *
     * @param args.urls       The array of URLs to fetch (required).
     * @param args.max_chars  Max characters to return per URL (default: config default, max: config limit).
     * @param args.raw        If true, return raw response instead of extracted text.
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const rawUrls = args.urls;
        if (!Array.isArray(rawUrls) || rawUrls.length === 0) {
            return {
                result: "'urls' must be a non-empty array of strings",
                status: ResultStatus.Error
            };
        }

        const raw = args.raw === true;
        const maxChars =
            typeof args.max_chars === 'number'
                ? Math.max(
                      1,
                      Math.min(Math.floor(args.max_chars), this.config.maxCharsPerFetchLimit)
                  )
                : this.config.maxCharsPerFetch;

        const concurrency = Math.max(1, this.config.concurrency);

        const promises = rawUrls.map((u) => () => this.fetchSingleUrl(u, maxChars, raw));

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
     * @param raw      If true, return raw response instead of extracted text.
     * @returns A PartialToolResult with the fetched content or an error.
     */
    private async fetchSingleUrl(
        url: unknown,
        maxChars: number,
        raw: boolean
    ): Promise<PartialToolResult> {
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

            if (!raw) {
                const contentType = response.headers.get('content-type') || 'text/plain';

                if (!contentType.startsWith('text/html') && !contentType.startsWith('text/plain')) {
                    return {
                        result: `${trimmedUrl}: Unsupported content type: ${contentType}. Only HTML and plain text are supported.`,
                        status: ResultStatus.Error
                    };
                }
            }

            const body = await response.text();

            if (raw) {
                return {
                    result: truncate(body, maxChars),
                    status: ResultStatus.Success
                };
            }

            const extracted = extractText(body, trimmedUrl);
            const title = extracted.title || trimmedUrl;
            const content = truncate(extracted.textContent, maxChars);
            const result = `${title}\n\n${content}\n\nURL: ${response.url || trimmedUrl}`;

            return {
                result,
                status: ResultStatus.Success
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown fetch error';
            return {
                result: `${trimmedUrl}: Web fetch error: ${message}`,
                status: ResultStatus.Error
            };
        }
    }
}
