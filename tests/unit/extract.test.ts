import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@mozilla/readability', () => ({
    isProbablyReaderable: vi.fn(),
    Readability: vi.fn()
}));

import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { extractText } from '../../src/lib/extract.js';

const MIN_CONTENT = 'This is a sufficiently long text content that should pass the minimum length threshold for extraction and demonstrate proper handling of various edge cases in the extraction pipeline.';

describe('extractText', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('falls back when Readability parse returns null', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(true);
        vi.mocked(Readability).mockImplementation(function () {
            return { parse: vi.fn().mockReturnValue(null) };
        });

        const result = extractText(
            '<html><head><title>Test</title></head><body><div class="content"><p>This fallback content is long enough to be picked up by the selector-based extraction path when readability parsing fails.</p></div></body></html>'
        );
        expect(result.title).toBe('Test');
        expect(result.textContent).toContain('fallback content');
    });

    it('falls back when Readability article has empty textContent', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(true);
        vi.mocked(Readability).mockImplementation(function () {
            return {
                parse: vi.fn().mockReturnValue({
                    title: 'ReadTitle',
                    textContent: '',
                    content: '',
                    excerpt: '',
                    byline: null,
                    siteName: null
                })
            };
        });

        const result = extractText(
            '<html><head><title>Fallback</title></head><body><p>Fallback body text that should be used because Readability returned empty content for this particular test case scenario.</p></body></html>'
        );
        expect(result.textContent).toContain('Fallback body text');
        expect(result.title).toBe('Fallback');
    });

    it('falls back when Readability article textContent is too short', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(true);
        vi.mocked(Readability).mockImplementation(function () {
            return {
                parse: vi.fn().mockReturnValue({
                    title: 'Short',
                    textContent: 'short',
                    content: '<p>short</p>',
                    excerpt: '',
                    byline: null,
                    siteName: null
                })
            };
        });

        const result = extractText(
            '<html><head><title>Title</title></head><body><div class="entry-content"><p>This is the fallback content that should be used when readability result was too short to meet the minimum length requirement of one hundred characters in this test case scenario.</p></div></body></html>'
        );
        expect(result.textContent).toContain('fallback content');
    });

    it('handles null title, content, and excerpt from Readability', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(true);
        vi.mocked(Readability).mockImplementation(function () {
            return {
                parse: vi.fn().mockReturnValue({
                    title: null,
                    textContent: MIN_CONTENT,
                    content: null,
                    excerpt: null,
                    byline: null,
                    siteName: null
                })
            };
        });

        const result = extractText('<html><body><article><p>Content</p></article></body></html>');
        expect(result.title).toBe('');
        expect(result.textContent).toContain('sufficiently long');
        expect(result.content).toBe('');
        expect(result.excerpt).toBe('');
    });

    it('uses body text when no fallback selector matches', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(false);

        const result = extractText(
            '<html><head><title>Body Fallback</title></head><body><p>No matching selector but body has plenty of text content to be used as the extraction result in this fallback scenario for testing purposes.</p></body></html>'
        );
        expect(result.title).toBe('Body Fallback');
        expect(result.textContent).toContain('No matching selector');
        expect(result.content).toContain('No matching selector');
    });

    it('handles empty body in fallback path', () => {
        vi.mocked(isProbablyReaderable).mockReturnValue(false);

        const result = extractText('<html><head><title>Empty</title></head><body></body></html>');
        expect(result.title).toBe('Empty');
        expect(result.textContent).toBe('');
        expect(result.content).toBe('');
    });
});
