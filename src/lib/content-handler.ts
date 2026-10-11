import type { PartialToolResult } from '@johannes.latzel/llm-chat';

/**
 * Per-call options passed to {@link ContentHandler.handle}.
 *
 * @property maxChars Maximum characters allowed in the returned content.
 * @property maxPages Optional page cap for paginated formats (e.g. PDF).
 *                    Handlers for non-paginated formats ignore it.
 */
export interface HandleOptions {
    maxChars: number;
    maxPages?: number | undefined;
}

/**
 * A content-type handler that can inspect and process HTTP response bodies.
 *
 * Implementations are registered in a `FetchRegistry` (exported as
 * `ContentHandlerRegistry`) and dispatched to based on the `Content-Type`
 * response header.
 */
export interface ContentHandler {
    /** Human-readable handler name (e.g. `"html"`, `"json"`). */
    readonly name: string;

    /**
     * Return `true` when this handler should process the given content type.
     *
     * @param contentType The `Content-Type` header value from the HTTP response
     *                    (e.g. `"text/html; charset=utf-8"`).
     */
    match(contentType: string): boolean;

    /**
     * Process the response body and produce a tool result.
     *
     * The body is delivered as raw bytes so handlers for binary formats (e.g.
     * PDF) can read it without lossy text decoding; text handlers decode it
     * themselves.
     *
     * @param body        The raw response body as bytes.
     * @param url         The original request URL (used for error messages and extraction).
     * @param responseUrl The final URL after redirects.
     * @param options     Per-call options: the character budget and an optional page cap.
     * @returns A tool result containing the processed content or an error.
     */
    handle(
        body: Uint8Array,
        url: string,
        responseUrl: string,
        options: HandleOptions
    ): Promise<PartialToolResult> | PartialToolResult;
}
