import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Handles `text/csv` responses by returning the body as-is.
 */
export class CsvHandler implements ContentHandler {
    readonly name = 'csv';

    /** Matches any content type starting with `text/csv`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/csv');
    }

    /** Return the raw CSV body, truncated if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        return {
            result: truncate(body, maxChars),
            status: ResultStatus.Success
        };
    }
}
