import type { PartialToolResult } from '@johannes.latzel/llm-chat';

/**
 * A content-type handler that can inspect and process HTTP response bodies.
 *
 * Implementations are registered in a {@link ContentHandlerRegistry} and
 * dispatched to based on the `Content-Type` response header.
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
     * @param body        The raw response body as text.
     * @param url         The original request URL (used for error messages and extraction).
     * @param responseUrl The final URL after redirects.
     * @param maxChars    Maximum characters allowed in the returned content.
     * @returns A tool result containing the processed content or an error.
     */
    handle(
        body: string,
        url: string,
        responseUrl: string,
        maxChars: number
    ): Promise<PartialToolResult> | PartialToolResult;
}
