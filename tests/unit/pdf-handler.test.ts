import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultStatus } from '@johannes.latzel/llm-chat';

vi.mock('unpdf', () => ({
    getDocumentProxy: vi.fn(),
    extractText: vi.fn()
}));

import { extractText, getDocumentProxy } from 'unpdf';
import { PdfHandler } from '../../src/lib/content-handlers/pdf-handler.js';

function fakeProxy() {
    return {};
}

const bytes = new TextEncoder().encode('%PDF-1.4 fake');

describe('PdfHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('matches application/pdf and application/x-pdf', () => {
        const handler = new PdfHandler();
        expect(handler.match('application/pdf')).toBe(true);
        expect(handler.match('application/pdf; charset=binary')).toBe(true);
        expect(handler.match('application/x-pdf')).toBe(true);
        expect(handler.match('text/html')).toBe(false);
    });

    it('extracts the text layer from a digital PDF', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({ totalPages: 1, text: ['Hello PDF'] } as never);

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'https://example.com/a.pdf', 'https://example.com/a.pdf', {
            maxChars: 1000
        });

        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toBe('Hello PDF');
    });

    it('returns an explanatory success for a textless PDF', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({ totalPages: 1, text: ['   '] } as never);

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('No extractable text layer');
    });

    it('caps the number of pages and notes the truncation', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({ totalPages: 3, text: ['p1', 'p2', 'p3'] } as never);

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000, maxPages: 1 });

        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('p1');
        expect(result.result).not.toContain('p2');
        expect(result.result).toContain('[PDF truncated to the first 1 of 3 pages]');
    });

    it('uses the configured page cap when no per-call cap is given', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({ totalPages: 3, text: ['p1', 'p2', 'p3'] } as never);

        const handler = new PdfHandler({ maxPages: 2 });
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.result).toContain('p2');
        expect(result.result).not.toContain('p3');
        expect(result.result).toContain('[PDF truncated to the first 2 of 3 pages]');
    });

    it('truncates the extracted text to maxChars and notes it', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({ totalPages: 1, text: ['A'.repeat(500)] } as never);

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 50 });

        expect(result.status).toBe(ResultStatus.Success);
        expect(result.result).toContain('[truncated]');
        expect(result.result).toContain('[PDF text truncated to 50 of 500 characters]');
    });

    it('notes both the page cap and the character limit', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockResolvedValue({
            totalPages: 3,
            text: ['A'.repeat(300), 'B'.repeat(300)]
        } as never);

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 50, maxPages: 1 });

        expect(result.result).toContain('[PDF truncated to the first 1 of 3 pages]');
        expect(result.result).toContain('[PDF text truncated to 50 of 300 characters]');
    });

    it('returns an error when the PDF cannot be loaded', async () => {
        vi.mocked(getDocumentProxy).mockRejectedValue(new Error('Invalid PDF structure'));

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toBe('Failed to extract text from PDF: Invalid PDF structure');
    });

    it('reports encrypted or password-protected PDFs', async () => {
        vi.mocked(getDocumentProxy).mockRejectedValue(new Error('No password given'));

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toBe('PDF is encrypted or password-protected and cannot be read.');
    });

    it('returns an error when text extraction fails', async () => {
        const proxy = fakeProxy();
        vi.mocked(getDocumentProxy).mockResolvedValue(proxy as never);
        vi.mocked(extractText).mockRejectedValue(new Error('extraction boom'));

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toBe('Failed to extract text from PDF: extraction boom');
    });

    it('stringifies non-Error load failures', async () => {
        vi.mocked(getDocumentProxy).mockRejectedValue('weird failure');

        const handler = new PdfHandler();
        const result = await handler.handle(bytes, 'u', 'u', { maxChars: 1000 });

        expect(result.status).toBe(ResultStatus.Error);
        expect(result.result).toBe('Failed to extract text from PDF: weird failure');
    });
});
