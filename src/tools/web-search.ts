import { WebSearchConfiguration } from '../lib/config.js';
import { WebSearchProvider } from '../lib/types.js';
import { SearchProvider } from '../lib/search/base.js';
import { DuckDuckGoProvider } from '../lib/search/duckduckgo.js';
import { TavilyProvider } from '../lib/search/tavily.js';
import { ExaAIProvider } from '../lib/search/exaai.js';
import type { WebSearchResult } from '../lib/types.js';
import {
    PropertyType,
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters
} from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';

function createProvider(config: WebSearchConfiguration): SearchProvider {
    const timeoutMs = config.searchTimeoutMs;
    switch (config.provider) {
        case WebSearchProvider.DuckDuckGo:
            return new DuckDuckGoProvider(timeoutMs);
        case WebSearchProvider.Tavily:
            return new TavilyProvider(config.apiKey, timeoutMs);
        case WebSearchProvider.ExaAI:
            return new ExaAIProvider(config.apiKey, timeoutMs);
        default:
            throw new Error('Unknown web search provider: ' + config.provider);
    }
}

/** Tool that searches the web and returns relevant results with titles, URLs, and content. */
export class WebSearchTool extends Tool {
    private readonly config: WebSearchConfiguration;

    /**
     * @param config Search configuration (provider, API key, limits, etc.).
     */
    constructor(config: WebSearchConfiguration) {
        super(
            'web_search',
            'Searches the web for information and returns relevant results with titles, URLs, and content. Use this when you need up-to-date information or facts you are not certain about.',
            new ToolParameters(
                {
                    query: new ToolParameterProperty('The search query'),
                    max_results: new ToolParameterProperty(
                        'Maximum number of search results to return (default: 5, max: 20)',
                        PropertyType.Number
                    ),
                    max_chars_per_result: new ToolParameterProperty(
                        'Maximum characters per result (default: 2000, max: 50000)',
                        PropertyType.Number
                    )
                },
                ['query']
            )
        );
        this.config = config;
    }

    /**
     * Execute the search.
     *
     * @param args.query                The search query (required).
     * @param args.max_results          Max results to return (default: 5, max: 20).
     * @param args.max_chars_per_result Max characters per result (default: 2000, max: 50000).
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const query = args.query;
        if (typeof query !== 'string' || !query.trim()) {
            return {
                result: "Required parameter 'query' is missing or not a string",
                status: ResultStatus.Error
            };
        }

        const maxResults =
            typeof args.max_results === 'number'
                ? Math.min(Math.max(1, Math.floor(args.max_results)), 20)
                : this.config.maxResults;

        const maxCharsPerResult =
            typeof args.max_chars_per_result === 'number'
                ? Math.min(Math.max(1, Math.floor(args.max_chars_per_result)), 50000)
                : this.config.maxCharsPerResult;

        try {
            let provider: SearchProvider;
            try {
                provider = createProvider(this.config);
            } catch (e) {
                return {
                    result: (e as Error).message,
                    status: ResultStatus.Error
                };
            }

            const results: WebSearchResult[] = await provider.search(
                query,
                maxResults,
                maxCharsPerResult
            );

            if (results.length === 0) {
                return {
                    result: 'No search results found for the query.',
                    status: ResultStatus.Success
                };
            }

            const formatted = results
                .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content}`)
                .join('\n\n');

            return {
                result: `Search results for "${query}":\n\n${formatted}`,
                status: ResultStatus.Success
            };
        } catch (e) {
            return {
                result: `Web search error: ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }
    }
}
