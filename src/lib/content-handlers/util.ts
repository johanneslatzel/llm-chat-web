/**
 * Truncate a string so it fits within {@link maxChars} characters.
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
 * @returns The original string if it fits, or a truncated version with a
 *          marker.
 */
export function truncate(str: string, maxChars: number): string {
    if (str.length <= maxChars) return str;

    const truncatedMarker = '[truncated]';
    const ellipsis = '...';
    const ellipsisMarker = `${ellipsis} ${truncatedMarker}`;

    if (maxChars <= ellipsisMarker.length) return ellipsisMarker;

    const truncated = str.substring(0, maxChars);

    // Paragraph boundary
    const paraIdx = truncated.lastIndexOf('\n\n');
    if (paraIdx !== -1) {
        return str.substring(0, paraIdx) + `\n\n${truncatedMarker}`;
    }

    // Sentence boundary
    const sentenceRegex = /[.!?]\s/g;
    let sentenceIdx = -1;
    let match;
    while ((match = sentenceRegex.exec(truncated)) !== null) {
        sentenceIdx = match.index + 1;
    }
    if (sentenceIdx !== -1) {
        return str.substring(0, sentenceIdx) + ` ${truncatedMarker}`;
    }

    // Word boundary
    const spaceIdx = truncated.lastIndexOf(' ');
    if (spaceIdx !== -1) {
        return str.substring(0, spaceIdx) + ` ${ellipsisMarker}`;
    }

    // Hard cut
    return str.substring(0, maxChars) + ` ${truncatedMarker}`;
}
