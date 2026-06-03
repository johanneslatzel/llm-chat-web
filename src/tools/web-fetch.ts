import { WebFetchConfiguration } from '../lib/config.js';
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

/** Tool that fetches a single URL and returns its content as extracted plain text. */
export class WebFetchTool extends Tool {
    private readonly config: WebFetchConfiguration;

    /**
     * @param config Fetch configuration (timeout, size limits, etc.).
     */
    constructor(config: WebFetchConfiguration) {
        super(
            'web_fetch',
            'Fetches a URL and returns its content as clean text. Use this when you need to read the full content of a web page, article, or documentation.',
            new ToolParameters(
                {
                    url: new ToolParameterProperty('The URL to fetch (required)'),
                    max_chars: new ToolParameterProperty(
                        'Maximum characters to return (default: 10000, max: 100000)',
                        PropertyType.Number
                    ),
                    raw: new ToolParameterProperty(
                        'If true, return raw reponse instead of extracted text (e.g. json, xml or source code response expected)',
                        PropertyType.Boolean
                    )
                },
                ['url']
            )
        );
        this.config = config;
    }

    /**
     * Execute the fetch.
     *
     * @param args.url       The URL to fetch (required).
     * @param args.max_chars Max characters to return (default: 10000, max: 100000).
     * @param args.raw       If true, return raw response instead of extracted text.
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const url = args.url;
        if (typeof url !== 'string' || !url.trim()) {
            return {
                result: "Required parameter 'url' is missing or not a string",
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

        try {
            const trimmedUrl = url.trim();

            const contentLength = await getContentLength(trimmedUrl, {
                timeout: this.config.fetchTimeoutMs
            });

            if (contentLength !== undefined && contentLength > this.config.maxContentLengthBytes) {
                return {
                    result: `Content too large: ${contentLength} bytes exceeds limit of ${this.config.maxContentLengthBytes} bytes`,
                    status: ResultStatus.Error
                };
            }

            const response = await fetchWithTimeout(trimmedUrl, {
                timeout: this.config.fetchTimeoutMs
            });

            if (!response.ok) {
                return {
                    result: `HTTP error ${response.status}: ${response.statusText}`,
                    status: ResultStatus.Error
                };
            }

            if (!raw) {
                const contentType = response.headers.get('content-type') || 'text/plain';

                if (!contentType.startsWith('text/html') && !contentType.startsWith('text/plain')) {
                    return {
                        result: `Unsupported content type: ${contentType}. Only HTML and plain text are supported.`,
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
                result: `Web fetch error: ${message}`,
                status: ResultStatus.Error
            };
        }
    }
}
