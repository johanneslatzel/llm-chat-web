import { RawTextHandler } from './raw-text-handler.js';

/**
 * Handles `text/markdown` responses by returning the body as-is.
 */
export class MarkdownHandler extends RawTextHandler {
    readonly name = 'markdown';

    /** Matches any content type starting with `text/markdown`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/markdown');
    }
}
