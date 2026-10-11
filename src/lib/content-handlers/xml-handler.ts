import { RawTextHandler } from './raw-text-handler.js';

/**
 * Handles XML responses (`application/xml`, `text/xml`, and
 * `application/*+xml`) by returning the body as-is.
 */
export class XmlHandler extends RawTextHandler {
    readonly name = 'xml';

    /** Matches `application/xml`, `text/xml`, or any `+xml` subtype. */
    match(contentType: string): boolean {
        return (
            contentType.startsWith('application/xml') ||
            contentType.startsWith('text/xml') ||
            contentType.includes('+xml')
        );
    }
}
