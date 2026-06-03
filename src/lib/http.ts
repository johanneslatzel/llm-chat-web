import { FETCH_TIMEOUT_DEFAULT_MS, DEFAULT_USER_AGENT } from './config.js';

/**
 * Options for an HTTP fetch request.
 *
 * @property timeout  Request timeout in milliseconds. Defaults to `FETCH_TIMEOUT_DEFAULT_MS`.
 * @property headers  Additional headers merged on top of the default User-Agent.
 */
export type FetchOptions = {
    timeout?: number;
    headers?: Record<string, string>;
};

export async function fetchWithTimeout(url: string, options?: FetchOptions): Promise<Response> {
    const timeout = options?.timeout ?? FETCH_TIMEOUT_DEFAULT_MS;
    const headers: Record<string, string> = {
        'User-Agent': DEFAULT_USER_AGENT
    };
    if (options?.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
            headers[key] = value;
        }
    }

    return fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeout)
    });
}

export async function getContentLength(
    url: string,
    options?: { timeout?: number }
): Promise<number | undefined> {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(options?.timeout ?? FETCH_TIMEOUT_DEFAULT_MS),
            headers: { 'User-Agent': DEFAULT_USER_AGENT }
        });

        if (!response.ok) {
            return undefined;
        }

        const cl = response.headers.get('content-length');
        return cl ? Number(cl) : undefined;
    } catch {
        return undefined;
    }
}
