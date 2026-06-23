import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import type { ContentHandler } from '../content-handler.js';
import { truncate } from './util.js';

/**
 * Catch-all handler for any `text/*` content type that isn't matched by a
 * more specific handler (e.g. `text/javascript`, `text/css`).
 *
 * Does **not** match `text/html` — the {@link HtmlHandler} takes priority.
 */
export class GenericTextHandler implements ContentHandler {
    readonly name = 'generic-text';

    /** Matches `text/*` except `text/html`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/') && !contentType.startsWith('text/html');
    }

    /** Return the raw body, truncated if necessary. */
    handle(body: string, _url: string, _responseUrl: string, maxChars: number): PartialToolResult {
        return {
            result: truncate(body, maxChars),
            status: ResultStatus.Success
        };
    }
}
