import { ResultStatus } from '@johannes.latzel/llm-chat';
import type { PartialToolResult } from '@johannes.latzel/llm-chat';
import { extractText, getDocumentProxy } from 'unpdf';
import type { ContentHandler, HandleOptions } from '../content-handler.js';
import { truncateWithHint } from './util.js';

/** Options for {@link PdfHandler}. */
export interface PdfHandlerOptions {
    /** Default maximum number of pages to extract. Defaults to `100`. */
    maxPages?: number | undefined;
}

/** Fallback page cap used when none is configured. */
const DEFAULT_MAX_PAGES = 100;

/**
 * Handles `application/pdf` and `application/x-pdf` responses by extracting the
 * document's text layer with Mozilla PDF.js (via `unpdf`).
 *
 * Only embedded text is extracted: scanned/image-only PDFs have no text layer
 * and yield an explanatory success message, while encrypted or malformed PDFs
 * produce an error result. A page cap (`maxPages`) bounds the extraction work.
 */
export class PdfHandler implements ContentHandler {
    readonly name = 'pdf';

    private readonly maxPages: number;

    /**
     * @param options Optional handler options. `maxPages` is the default page
     *                cap; a per-call `options.maxPages` overrides it.
     */
    constructor(options: PdfHandlerOptions = {}) {
        this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    }

    /** Matches `application/pdf` and `application/x-pdf`. */
    match(contentType: string): boolean {
        return (
            contentType.startsWith('application/pdf') || contentType.startsWith('application/x-pdf')
        );
    }

    /**
     * Extract the text layer, cap the number of pages, and truncate the result
     * to the configured character budget.
     */
    async handle(
        body: Uint8Array,
        _url: string,
        _responseUrl: string,
        options: HandleOptions
    ): Promise<PartialToolResult> {
        const pageLimit = options.maxPages ?? this.maxPages;

        let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
        try {
            pdf = await getDocumentProxy(body);
        } catch (error) {
            return this.errorResult(error);
        }

        try {
            const extracted = await extractText(pdf, { mergePages: false });
            const pages = extracted.text;
            const text = pages.slice(0, pageLimit).join('\n\n').trim();

            if (text.length === 0) {
                return {
                    result: 'No extractable text layer found in PDF (likely a scanned or image-only document).',
                    status: ResultStatus.Success
                };
            }

            const { text: truncatedText, hint } = truncateWithHint(
                text,
                options.maxChars,
                'PDF text'
            );
            const notes: string[] = [];
            if (hint !== undefined) {
                notes.push(hint);
            }
            if (pages.length > pageLimit) {
                notes.push(
                    `[PDF truncated to the first ${pageLimit} of ${extracted.totalPages} pages]`
                );
            }
            return {
                result: notes.length > 0 ? `${truncatedText}\n\n${notes.join(' ')}` : truncatedText,
                status: ResultStatus.Success
            };
        } catch (error) {
            return this.errorResult(error);
        }
    }

    /** Map a PDF failure to an error result, distinguishing password protection. */
    private errorResult(error: unknown): PartialToolResult {
        const message = error instanceof Error ? error.message : String(error);
        const isPassword = /password/i.test(message);
        return {
            result: isPassword
                ? 'PDF is encrypted or password-protected and cannot be read.'
                : `Failed to extract text from PDF: ${message}`,
            status: ResultStatus.Error
        };
    }
}
