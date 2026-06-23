import { ToolPackage } from '@johannes.latzel/llm-chat';
import { WebSearchConfiguration, WebFetchConfiguration } from '../lib/config.js';
import { WebSearchTool } from './web-search.js';
import { WebFetchTool } from './web-fetch.js';
import { FetchRegistry } from '../lib/fetch-registry.js';

/**
 * Convenience package that bundles both {@link WebSearchTool} and
 * {@link WebFetchTool} into a single {@link ToolPackage}.
 *
 * Create an instance and pass it to the LLM runtime to make both tools
 * available at once.
 */
export class WebToolsPackage extends ToolPackage {
    /**
     * @param searchConfig Optional search configuration. Defaults to
     *                     environment-based defaults.
     * @param fetchConfig  Optional fetch configuration. Defaults to
     *                     environment-based defaults.
     * @param fetchRegistry Optional content-handler registry for fetch
     *                      responses. Defaults to the built-in registry.
     */
    constructor(
        searchConfig?: WebSearchConfiguration,
        fetchConfig?: WebFetchConfiguration,
        fetchRegistry?: FetchRegistry
    ) {
        const search = searchConfig ?? new WebSearchConfiguration();
        const fetch = fetchConfig ?? new WebFetchConfiguration();

        super([new WebSearchTool(search), new WebFetchTool(fetch, fetchRegistry)]);
    }
}
