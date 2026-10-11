import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler, HandleOptions } from '../content-handler.js';
import { appendHint, decodeBody, truncateWithHint } from './util.js';

/**
 * Base class for handlers that return the decoded response body as plain text,
 * truncated to the character budget.
 *
 * Subclasses only supply a {@link ContentHandler.name} and a
 * {@link ContentHandler.match} implementation.
 */
export abstract class RawTextHandler implements ContentHandler {
    /** Human-readable handler name (e.g. `"csv"`, `"xml"`). */
    abstract readonly name: string;

    /**
     * Return `true` when this handler should process the given content type.
     *
     * @param contentType The `Content-Type` header value from the HTTP response.
     */
    abstract match(contentType: string): boolean;

    /** Return the decoded body, truncated to the character budget. */
    handle(
        body: Uint8Array,
        _url: string,
        _responseUrl: string,
        options: HandleOptions
    ): PartialToolResult {
        const { text, hint } = truncateWithHint(decodeBody(body), options.maxChars);
        return {
            result: appendHint(text, hint),
            status: ResultStatus.Success
        };
    }
}
