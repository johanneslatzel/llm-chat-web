import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler, HandleOptions } from '../content-handler.js';
import { extractText } from '../extract.js';
import { appendHint, decodeBody, truncateWithHint } from './util.js';

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
    handle(
        body: Uint8Array,
        url: string,
        responseUrl: string,
        options: HandleOptions
    ): PartialToolResult {
        const extracted = extractText(decodeBody(body), url);
        const title = extracted.title || url;
        const { text, hint } = truncateWithHint(
            extracted.textContent,
            options.maxChars,
            'HTML text'
        );
        return {
            result: appendHint(`${title}\n\n${text}\n\nURL: ${responseUrl}`, hint),
            status: ResultStatus.Success
        };
    }
}
