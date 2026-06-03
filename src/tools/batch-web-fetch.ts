import { BatchWebFetchConfiguration } from '../lib/config.js';
import { fetchWithTimeout, getContentLength } from '../lib/http.js';
import { extractText } from '../lib/extract.js';
import {
    PropertyType,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import pMap from 'p-map';

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

function parseJsonArray(value: unknown): string[] | null {
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return null;
        if (parsed.length === 0) return null;
        return parsed.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
        );
    } catch {
        return null;
    }
}

type FetchResult = {
    url: string;
    success: boolean;
    title?: string;
    content?: string;
    error?: string;
};

async function fetchSingleUrl(
    url: string,
    maxChars: number,
    raw: boolean,
    config: BatchWebFetchConfiguration
): Promise<FetchResult> {
    const { fetchConfig } = config;

    try {
        const trimmedUrl = url.trim();

        const contentLength = await getContentLength(trimmedUrl, {
            timeout: fetchConfig.fetchTimeoutMs
        });

        if (contentLength !== undefined && contentLength > fetchConfig.maxContentLengthBytes) {
            return {
                url,
                success: false,
                error: `Content too large: ${contentLength} bytes exceeds limit of ${fetchConfig.maxContentLengthBytes} bytes`
            };
        }

        const response = await fetchWithTimeout(trimmedUrl, {
            timeout: fetchConfig.fetchTimeoutMs
        });

        if (!response.ok) {
            return {
                url,
                success: false,
                error: `HTTP error ${response.status}: ${response.statusText}`
            };
        }

        if (!raw) {
            const contentType = response.headers.get('content-type') || 'text/plain';
            if (!contentType.startsWith('text/html') && !contentType.startsWith('text/plain')) {
                return {
                    url,
                    success: false,
                    error: `Unsupported content type: ${contentType}. Only HTML and plain text are supported.`
                };
            }
        }

        const body = await response.text();

        if (raw) {
            return {
                url,
                success: true,
                content: truncate(body, maxChars)
            };
        }

        const extracted = extractText(body, trimmedUrl);
        const title = extracted.title || trimmedUrl;
        const content = truncate(extracted.textContent, maxChars);
        const result = `${title}\n\n${content}\n\nURL: ${response.url || trimmedUrl}`;

        return {
            url,
            success: true,
            title,
            content: result
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown fetch error';
        return {
            url,
            success: false,
            error: `Web fetch error: ${message}`
        };
    }
}

/** Tool that fetches multiple URLs in parallel and returns their content as extracted plain text. */
export class BatchWebFetchTool extends Tool {
    private readonly config: BatchWebFetchConfiguration;

    /**
     * @param config Batch-fetch configuration (concurrency, size limits, etc.).
     */
    constructor(config: BatchWebFetchConfiguration) {
        super(
            'batch_web_fetch',
            'Fetches multiple URLs in parallel and returns their content as clean text. Accepts a JSON array of URLs. Use this when you need to read the full content of multiple web pages, articles, or documentation at once.',
            new ToolParameters(
                {
                    urls: new ToolParameterProperty(
                        'JSON array of URLs to fetch, e.g. ["https://example.com", "https://example.org"]'
                    ),
                    max_chars: new ToolParameterProperty(
                        'Maximum characters to return per URL (default: 10000, max: 100000)',
                        PropertyType.Number
                    ),
                    raw: new ToolParameterProperty(
                        'If true, return raw response instead of extracted text for each URL (e.g. json, xml or source code response expected)',
                        PropertyType.Boolean
                    ),
                    concurrency: new ToolParameterProperty(
                        'Maximum number of concurrent fetches (default: 3, max: 10)',
                        PropertyType.Number
                    )
                },
                ['urls']
            )
        );
        this.config = config;
    }

    /**
     * Execute the batch fetch.
     *
     * @param args.urls         JSON array of URLs to fetch (required).
     * @param args.max_chars    Max characters per URL (default: 10000, max: 100000).
     * @param args.raw          If true, return raw response for each URL.
     * @param args.concurrency  Max concurrent fetches (default: 3, max: 10).
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const urls = parseJsonArray(args.urls);
        if (!urls || urls.length === 0) {
            return {
                result: "Required parameter 'urls' must be a JSON array of URL strings, e.g. '[\"https://example.com\"]'",
                status: ResultStatus.Error
            };
        }

        const raw = args.raw === true;
        const maxChars =
            typeof args.max_chars === 'number'
                ? Math.max(
                      1,
                      Math.min(
                          Math.floor(args.max_chars),
                          this.config.fetchConfig.maxCharsPerFetchLimit
                      )
                  )
                : this.config.fetchConfig.maxCharsPerFetch;

        const concurrency =
            typeof args.concurrency === 'number'
                ? Math.max(1, Math.min(Math.floor(args.concurrency), this.config.maxConcurrency))
                : this.config.concurrency;

        try {
            const results: FetchResult[] = await pMap(
                urls,
                (url) => fetchSingleUrl(url, maxChars, raw, this.config),
                { concurrency, stopOnError: false }
            );

            const total = results.length;
            const successful = results.filter((r) => r.success).length;
            const failed = total - successful;

            const formatted = results
                .map((r, i) => {
                    const header = `[${i + 1}] ${r.url}`;
                    if (r.success) {
                        return `${header}\n${r.content}`;
                    }
                    return `${header}\nError: ${r.error}`;
                })
                .join('\n\n---\n\n');

            const summary = `Batch fetch complete: ${successful}/${total} URLs succeeded${failed > 0 ? `, ${failed} failed` : ''}.`;

            return {
                result: `${summary}\n\n${formatted}`,
                status: failed === total ? ResultStatus.Error : ResultStatus.Success
            };
        } catch (e) {
            return {
                result: `Batch web fetch error: ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }
    }
}
