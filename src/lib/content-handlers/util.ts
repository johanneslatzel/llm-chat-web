/**
 * Length metadata produced by {@link truncateWithInfo}.
 */
export interface TruncationInfo {
    /** The truncated text, including any truncation marker. */
    text: string;
    /** Number of source characters retained (0 when the budget only fits the marker). */
    keptLength: number;
    /** Total length of the source text before truncation. */
    originalLength: number;
}

/**
 * Truncate a string so it fits within {@link maxChars} characters, reporting
 * how many source characters were retained.
 *
 * Truncation tries boundaries in order of preference:
 *   1. paragraph boundary ( `\n\n` )
 *   2. sentence boundary ( `.`, `!`, `?` )
 *   3. word boundary (space)
 *   4. hard character cut
 *
 * The {@link maxChars} budget accounts for the truncation marker
 * (`... [truncated]` or `\n\n[truncated]` / ` [truncated]`).
 *
 * @param str      The string to truncate.
 * @param maxChars The maximum character count for the result.
 * @returns The truncated text plus length metadata.
 */
export function truncateWithInfo(str: string, maxChars: number): TruncationInfo {
    const originalLength = str.length;
    if (originalLength <= maxChars) {
        return { text: str, keptLength: originalLength, originalLength };
    }

    const truncatedMarker = '[truncated]';
    const ellipsis = '...';
    const ellipsisMarker = `${ellipsis} ${truncatedMarker}`;

    if (maxChars <= ellipsisMarker.length) {
        return { text: ellipsisMarker, keptLength: 0, originalLength };
    }

    const truncated = str.substring(0, maxChars);

    // Paragraph boundary
    const paraIdx = truncated.lastIndexOf('\n\n');
    if (paraIdx !== -1) {
        return {
            text: str.substring(0, paraIdx) + `\n\n${truncatedMarker}`,
            keptLength: paraIdx,
            originalLength
        };
    }

    // Sentence boundary
    const sentenceRegex = /[.!?]\s/g;
    let sentenceIdx = -1;
    let match;
    while ((match = sentenceRegex.exec(truncated)) !== null) {
        sentenceIdx = match.index + 1;
    }
    if (sentenceIdx !== -1) {
        return {
            text: str.substring(0, sentenceIdx) + ` ${truncatedMarker}`,
            keptLength: sentenceIdx,
            originalLength
        };
    }

    // Word boundary
    const spaceIdx = truncated.lastIndexOf(' ');
    if (spaceIdx !== -1) {
        return {
            text: str.substring(0, spaceIdx) + ` ${ellipsisMarker}`,
            keptLength: spaceIdx,
            originalLength
        };
    }

    // Hard cut
    return {
        text: str.substring(0, maxChars) + ` ${truncatedMarker}`,
        keptLength: maxChars,
        originalLength
    };
}

/**
 * Result of {@link truncateWithHint}.
 */
export interface TruncatedText {
    /** The truncated text, including the truncation marker. */
    text: string;
    /** A hint like `[text truncated to 50 of 500 characters]`, or `undefined` when nothing was truncated. */
    hint?: string | undefined;
}

/**
 * Truncate text to {@link maxChars} and build a character-count hint when
 * truncation happened.
 *
 * The hint names the content via {@link label}, e.g. `[PDF text truncated to
 * 50 of 500 characters]`. Append it to the result with {@link appendHint}.
 *
 * @param str      The text to truncate.
 * @param maxChars The maximum character count for the text.
 * @param label    Human-readable label for the content (default `"text"`).
 * @returns The truncated text and an optional hint.
 */
export function truncateWithHint(str: string, maxChars: number, label = 'text'): TruncatedText {
    const info = truncateWithInfo(str, maxChars);
    if (info.originalLength <= maxChars) {
        return { text: info.text };
    }
    return {
        text: info.text,
        hint: `[${label} truncated to ${info.keptLength} of ${info.originalLength} characters]`
    };
}

/**
 * Append an optional truncation hint to text, separated by a blank line.
 *
 * @param text The (possibly truncated) text.
 * @param hint The hint from {@link truncateWithHint}, or `undefined`.
 * @returns The text with the hint appended, or the text unchanged.
 */
export function appendHint(text: string, hint?: string): string {
    return hint === undefined ? text : `${text}\n\n${hint}`;
}

/**
 * Decode a raw response body to text as UTF-8.
 *
 * Text handlers use this to turn the bytes delivered by
 * {@link ContentHandler.handle} into a string.
 *
 * @param body The raw response bytes.
 * @returns The decoded text.
 */
export function decodeBody(body: Uint8Array): string {
    return new TextDecoder().decode(body);
}
