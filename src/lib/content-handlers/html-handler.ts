import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { extractText } from '../extract.js';
import { truncate } from './util.js';

/**
 * Handles `text/html` responses by extracting readable content via
 * Mozilla Readability with CSS-selector-based fallback.
 */
export class HtmlHandler implements ContentHandler {
    readonly name = 'html';

    /** Matches any content type starting with `text/html`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/html');
    }

    /**
     * Extract clean text from the HTML body and format as
     * `Title\n\nContent\n\nURL: <responseUrl>`.
     */
    handle(body: string, url: string, responseUrl: string, maxChars: number): PartialToolResult {
        const extracted = extractText(body, url);
        const title = extracted.title || url;
        const content = truncate(extracted.textContent, maxChars);
        return {
            result: `${title}\n\n${content}\n\nURL: ${responseUrl}`,
            status: ResultStatus.Success
        };
    }
}
