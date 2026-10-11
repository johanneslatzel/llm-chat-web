import { RawTextHandler } from './raw-text-handler.js';

/**
 * Handles `text/csv` responses by returning the body as-is.
 */
export class CsvHandler extends RawTextHandler {
    readonly name = 'csv';

    /** Matches any content type starting with `text/csv`. */
    match(contentType: string): boolean {
        return contentType.startsWith('text/csv');
    }
}
