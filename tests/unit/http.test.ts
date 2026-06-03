import { describe, it, expect, afterEach } from 'vitest';
import { getContentLength } from '../../src/lib/http.js';
import { mockFetch, restoreFetch } from '../index.js';

describe('getContentLength', () => {
    afterEach(() => {
        restoreFetch();
    });

    it('returns content length from HEAD', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '',
            headers: { 'content-type': 'text/html', 'content-length': '5000' }
        });
        const length = await getContentLength('https://example.com');
        expect(length).toBe(5000);
    });

    it('returns undefined when no content-length header', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '',
            headers: { 'content-type': 'text/html' }
        });
        const length = await getContentLength('https://example.com');
        expect(length).toBeUndefined();
    });

    it('works without options argument (uses default timeout)', async () => {
        mockFetch({
            ok: true,
            status: 200,
            statusText: 'OK',
            body: '',
            headers: { 'content-type': 'text/html', 'content-length': '1234' }
        });
        const length = await getContentLength('https://example.com');
        expect(length).toBe(1234);
    });

    it('returns undefined on failed HEAD request', async () => {
        mockFetch({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            body: 'Forbidden',
            headers: { 'content-type': 'text/html' }
        });
        const length = await getContentLength('https://example.com/secret');
        expect(length).toBeUndefined();
    });
});
