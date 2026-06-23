import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Handles `application/json` (and `application/*+json`) responses by
 * pretty-printing the JSON with 2-space indentation.
 *
 * If the body cannot be parsed as JSON, the raw body is returned instead.
 */
export class JsonHandler implements ContentHandler {
    readonly name = 'json';

    /**
     * Matches `application/json` or any content type containing `+json`
     * (e.g. `application/vnd.api+json`).
     */
    match(contentType: string): boolean {
        return contentType.startsWith('application/json') || contentType.includes('+json');
    }

    /** Pretty-print the JSON body and truncate if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        try {
            const content = JSON.stringify(JSON.parse(body), null, 2);
            return {
                result: truncate(content, maxChars),
                status: ResultStatus.Success
            };
        } catch {
            return {
                result: 'JSON could not be parsed',
                status: ResultStatus.Error
            };
        }
    }
}
