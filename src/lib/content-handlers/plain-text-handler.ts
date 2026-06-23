import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Handles `text/plain` responses by returning the body as-is.
 */
export class PlainTextHandler implements ContentHandler {
    readonly name = 'plain-text';

    /** Matches any content type starting with `text/plain`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/plain');
    }

    /** Return the raw text body, truncated if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        return {
            result: truncate(body, maxChars),
            status: ResultStatus.Success
        };
    }
}
