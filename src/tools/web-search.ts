import { WebSearchConfiguration } from '../lib/config.js';
import { WebSearchProvider } from '../lib/types.js';
import { SearchProvider } from '../lib/search/base.js';
import { DuckDuckGoProvider } from '../lib/search/duckduckgo.js';
import { TavilyProvider } from '../lib/search/tavily.js';
import { ExaAIProvider } from '../lib/search/exaai.js';
import type { WebSearchResult } from '../lib/types.js';
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
 * Create the appropriate search provider based on configuration.
 *
 * @param config Search configuration (provider, API key, limits, etc.).
 * @returns An instance of the configured SearchProvider.
 */
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

/**
 * Format search results into a human-readable string.
 *
 * @param query   The original search query.
 * @param results The search results to format.
 * @returns Formatted string with numbered results.
 */
function formatResults(query: string, results: WebSearchResult[]): string {
    if (results.length === 0) {
        return `No search results found for "${query}".`;
    }
    const formatted = results
        .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content}`)
        .join('\n\n');
    return `Search results for "${query}":\n\n${formatted}`;
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
            'Searches the web for one or more queries and returns relevant results with titles, URLs, and content. Pass an array of search queries ("queries"). Use this when you need up-to-date information or facts you are not certain about.',
            new ToolParameters(
                {
                    queries: new ToolParameterProperty(
                        'Array of search queries',
                        PropertyType.Array
                    ),
                    max_results: new ToolParameterProperty(
                        'Maximum number of search results to return per query (default: 5, max: 20)',
                        PropertyType.Number
                    ),
                    max_chars_per_result: new ToolParameterProperty(
                        'Maximum characters per result (default: 2000, max: 50000)',
                        PropertyType.Number
                    )
                },
                ['queries']
            )
        );
        this.config = config;
    }

    /**
     * Execute the search for one or more queries.
     *
     * @param args.queries              The array of search queries (required).
     * @param args.max_results          Max results to return per query (default: config default, max: 20).
     * @param args.max_chars_per_result Max characters per result (default: config default, max: 50000).
     */
    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const rawQueries = args.queries;
        if (!Array.isArray(rawQueries) || rawQueries.length === 0) {
            return {
                result: "'queries' must be a non-empty array of strings",
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

        let provider: SearchProvider;
        try {
            provider = createProvider(this.config);
        } catch (e) {
            return {
                result: (e as Error).message,
                status: ResultStatus.Error
            };
        }

        const concurrency = Math.max(1, this.config.concurrency);

        const promises = rawQueries.map(
            (q) => () => this.searchSingleQuery(q, provider, maxResults, maxCharsPerResult)
        );

        try {
            const results = await pMap(promises, (fn) => fn(), {
                concurrency,
                stopOnError: false
            });
            return ResultBuilder.from(results).build();
        } catch (e) {
            return {
                result: `Web search error: ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }
    }

    /**
     * Execute a single search query and return a PartialToolResult.
     *
     * @param query             The search query.
     * @param provider          The search provider to use.
     * @param maxResults        Max results to return.
     * @param maxCharsPerResult Max characters per result.
     * @returns A PartialToolResult with SUCCESS result string or Error status.
     */
    private async searchSingleQuery(
        query: unknown,
        provider: SearchProvider,
        maxResults: number,
        maxCharsPerResult: number
    ): Promise<PartialToolResult> {
        if (typeof query !== 'string' || !query.trim()) {
            return {
                result: 'Query must be a non-empty string',
                status: ResultStatus.Error
            };
        }

        try {
            const results: WebSearchResult[] = await provider.search(
                query,
                maxResults,
                maxCharsPerResult
            );
            return {
                result: formatResults(query, results),
                status: ResultStatus.Success
            };
        } catch (e) {
            return {
                result: `Search error for "${query}": ${(e as Error).message}`,
                status: ResultStatus.Error
            };
        }
    }
}
