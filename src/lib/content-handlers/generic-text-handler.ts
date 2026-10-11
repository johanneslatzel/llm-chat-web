import { RawTextHandler } from './raw-text-handler.js';

/**
 * Catch-all handler for any `text/*` content type that isn't matched by a
 * more specific handler (e.g. `text/javascript`, `text/css`).
 *
 * Does **not** match `text/html` — the `HtmlHandler` takes priority.
 */
export class GenericTextHandler extends RawTextHandler {
    readonly name = 'generic-text';

    /** Matches `text/*` except `text/html`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/') && !contentType.startsWith('text/html');
    }
}
