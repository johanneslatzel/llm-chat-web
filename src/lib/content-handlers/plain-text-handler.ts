import { RawTextHandler } from './raw-text-handler.js';

/**
 * Handles `text/plain` responses by returning the body as-is.
 */
export class PlainTextHandler extends RawTextHandler {
    readonly name = 'plain-text';

    /** Matches any content type starting with `text/plain`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/plain');
    }
}
