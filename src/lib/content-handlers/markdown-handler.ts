import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Handles `text/markdown` responses by returning the body as-is.
 */
export class MarkdownHandler implements ContentHandler {
    readonly name = 'markdown';

    /** Matches any content type starting with `text/markdown`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/markdown');
    }

    /** Return the raw markdown body, truncated if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        return {
            result: truncate(body, maxChars),
            status: ResultStatus.Success
        };
    }
}
