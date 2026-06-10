import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSearchConfiguration, WebFetchConfiguration, WebSearchProvider } from '../../src/index.js';

describe('WebSearchConfiguration', () => {
    let origEnv: Record<string, string | undefined>;

    beforeEach(() => {
        origEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it('defaults to DuckDuckGo with empty apiKey when no env', () => {
        const cfg = new WebSearchConfiguration();
        expect(cfg.provider).toBe(WebSearchProvider.DuckDuckGo);
        expect(cfg.apiKey).toBe('');
        expect(cfg.maxResults).toBe(5);
        expect(cfg.maxCharsPerResult).toBe(2000);
    });

    it('reads maxResults from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_MAX_RESULTS = '10';
        const cfg = new WebSearchConfiguration();
        expect(cfg.maxResults).toBe(10);
    });

    it('reads maxCharsPerResult from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT = '3000';
        const cfg = new WebSearchConfiguration();
        expect(cfg.maxCharsPerResult).toBe(3000);
    });

    it('accepts explicit apiKey and provider', () => {
        const cfg = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'my-key');
        expect(cfg.apiKey).toBe('my-key');
        expect(cfg.provider).toBe(WebSearchProvider.ExaAI);
    });

    it('reads apiKey from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_API_KEY = 'my-key';
        const cfg = new WebSearchConfiguration();
        expect(cfg.apiKey).toBe('my-key');
    });

    it('reads provider from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER = 'exaai';
        const cfg = new WebSearchConfiguration();
        expect(cfg.provider).toBe(WebSearchProvider.ExaAI);
    });

    it('reads DuckDuckGo provider from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER = 'duckduckgo';
        const cfg = new WebSearchConfiguration();
        expect(cfg.provider).toBe(WebSearchProvider.DuckDuckGo);
    });

    it('reads Tavily provider from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER = 'tavily';
        const cfg = new WebSearchConfiguration();
        expect(cfg.provider).toBe(WebSearchProvider.Tavily);
    });

    it('defaults searchTimeoutMs when no env set', () => {
        delete process.env.LLM_CHAT_WEB_SEARCH_TIMEOUT_MS;
        const cfg = new WebSearchConfiguration();
        expect(cfg.searchTimeoutMs).toBe(4000);
    });

    it('reads searchTimeoutMs from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_TIMEOUT_MS = '5000';
        const cfg = new WebSearchConfiguration();
        expect(cfg.searchTimeoutMs).toBe(5000);
    });

    it('falls back to default when envInt env var is empty string', () => {
        process.env.LLM_CHAT_WEB_SEARCH_MAX_RESULTS = '';
        const cfg = new WebSearchConfiguration();
        expect(cfg.maxResults).toBe(5);
    });

    it('falls back to default when envInt env var is non-numeric', () => {
        process.env.LLM_CHAT_WEB_SEARCH_MAX_RESULTS = 'abc';
        const cfg = new WebSearchConfiguration();
        expect(cfg.maxResults).toBe(5);
    });

    it('falls back to default when envInt env var is negative', () => {
        process.env.LLM_CHAT_WEB_SEARCH_MAX_RESULTS = '-5';
        const cfg = new WebSearchConfiguration();
        expect(cfg.maxResults).toBe(1);
    });
});

describe('WebFetchConfiguration', () => {
    let origEnv: Record<string, string | undefined>;

    beforeEach(() => {
        origEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it('defaults maxCharsPerFetch and limits', () => {
        const cfg = new WebFetchConfiguration();
        expect(cfg.maxCharsPerFetch).toBe(10000);
        expect(cfg.maxCharsPerFetchLimit).toBe(100000);
    });

    it('defaults fetch timeout values when no env set', () => {
        delete process.env.LLM_CHAT_WEB_FETCH_TIMEOUT_MS;
        delete process.env.LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES;
        const cfg = new WebFetchConfiguration();
        expect(cfg.fetchTimeoutMs).toBe(5000);
        expect(cfg.maxContentLengthBytes).toBe(10_000_000);
    });

    it('reads fetchTimeoutMs from env', () => {
        process.env.LLM_CHAT_WEB_FETCH_TIMEOUT_MS = '15000';
        const cfg = new WebFetchConfiguration();
        expect(cfg.fetchTimeoutMs).toBe(15000);
    });

    it('defaults maxContentLengthBytes when no env set', () => {
        delete process.env.LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES;
        const cfg = new WebFetchConfiguration();
        expect(cfg.maxContentLengthBytes).toBe(10_000_000);
    });

    it('reads maxContentLengthBytes from env', () => {
        process.env.LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES = '5000000';
        const cfg = new WebFetchConfiguration();
        expect(cfg.maxContentLengthBytes).toBe(5_000_000);
    });
});
