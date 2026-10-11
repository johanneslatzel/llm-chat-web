import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler, HandleOptions } from '../content-handler.js';
import { appendHint, decodeBody, truncateWithHint } from './util.js';

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
    handle(
        body: Uint8Array,
        _url: string,
        _responseUrl: string,
        options: HandleOptions
    ): PartialToolResult {
        try {
            const content = JSON.stringify(JSON.parse(decodeBody(body)), null, 2);
            const { text, hint } = truncateWithHint(content, options.maxChars, 'JSON');
            return {
                result: appendHint(text, hint),
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
