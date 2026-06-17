import { ToolPackage } from '@johannes.latzel/llm-chat';
import { WebSearchConfiguration, WebFetchConfiguration } from '../lib/config.js';
import { WebSearchTool } from './web-search.js';
import { WebFetchTool } from './web-fetch.js';

export class WebToolsPackage extends ToolPackage {
    constructor(searchConfig?: WebSearchConfiguration, fetchConfig?: WebFetchConfiguration) {
        const search = searchConfig ?? new WebSearchConfiguration();
        const fetch = fetchConfig ?? new WebFetchConfiguration();

        super([new WebSearchTool(search), new WebFetchTool(fetch)]);
    }
}
