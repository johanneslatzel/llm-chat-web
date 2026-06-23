import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Handles XML responses (`application/xml`, `text/xml`, and
 * `application/*+xml`) by returning the body as-is.
 */
export class XmlHandler implements ContentHandler {
    readonly name = 'xml';

    /** Matches `application/xml`, `text/xml`, or any `+xml` subtype. */
    match(contentType: string): boolean {
        return (
            contentType.startsWith('application/xml') ||
            contentType.startsWith('text/xml') ||
            contentType.includes('+xml')
        );
    }

    /** Return the raw XML body, truncated if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        return {
            result: truncate(body, maxChars),
            status: ResultStatus.Success
        };
    }
}
