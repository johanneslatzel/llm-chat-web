import { vi } from 'vitest';

export interface MockFetchResponse {
    ok: boolean;
    status: number;
    statusText: string;
    body: string;
    headers?: Record<string, string>;
}

function createResponse(response: MockFetchResponse) {
    const defaultHeaders: Record<string, string> = { 'content-type': 'text/plain' };
    const headers = new Headers({ ...defaultHeaders, ...response.headers });
    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text: () => Promise.resolve(response.body),
        json: () => Promise.resolve(JSON.parse(response.body)),
        headers,
        url: 'http://localhost'
    } as unknown as Response;
}

export function mockFetch(response: MockFetchResponse): void {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createResponse(response) as unknown as never);
}

export function mockFetchSequence(responses: MockFetchResponse[]): void {
    let idx = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        if (idx >= responses.length) {
            return Promise.reject(new Error('No more mock responses'));
        }
        return Promise.resolve(createResponse(responses[idx++]!));
    });
}

export function mockFetchError(error: Error): void {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(error);
}

export function restoreFetch(): void {
    vi.restoreAllMocks();
}
