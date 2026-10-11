import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    WebSearchConfiguration,
    WebFetchConfiguration,
    WebSearchProvider,
    ProviderStrategy
} from '../../src/index.js';
import type { ProviderEntry } from '../../src/index.js';

describe('WebSearchConfiguration', () => {
    let origEnv: Record<string, string | undefined>;

    beforeEach(() => {
        origEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it('resolves a single duckduckgo entry with single strategy under zero config', () => {
        delete process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS;
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers).toEqual([{ provider: WebSearchProvider.DuckDuckGo }]);
        expect(cfg.strategy).toBe(ProviderStrategy.Single);
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

    it('defaults maxPdfPages to 100', () => {
        delete process.env.LLM_CHAT_WEB_MAX_PDF_PAGES;
        const cfg = new WebFetchConfiguration();
        expect(cfg.maxPdfPages).toBe(100);
    });

    it('reads maxPdfPages from env', () => {
        process.env.LLM_CHAT_WEB_MAX_PDF_PAGES = '250';
        const cfg = new WebFetchConfiguration();
        expect(cfg.maxPdfPages).toBe(250);
    });

    it('defaults headerRules to an empty list', () => {
        const cfg = new WebFetchConfiguration();
        expect(cfg.headerRules).toEqual([]);
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


describe('WebSearchConfiguration multi-provider', () => {
    let origEnv: Record<string, string | undefined>;

    beforeEach(() => {
        origEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it('reads strategy from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY = 'weighted_random';
        const cfg = new WebSearchConfiguration();
        expect(cfg.strategy).toBe(ProviderStrategy.WeightedRandom);
    });

    it('falls back to Single for unknown strategy env values', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY = 'bogus';
        const cfg = new WebSearchConfiguration();
        expect(cfg.strategy).toBe(ProviderStrategy.Single);
    });

    it('stores providers array and explicit strategy from the multi-provider constructor', () => {
        const entries: ProviderEntry[] = [
            { provider: WebSearchProvider.Tavily, apiKey: 'k1', weight: 3 },
            { provider: WebSearchProvider.DuckDuckGo }
        ];
        const cfg = new WebSearchConfiguration(entries, ProviderStrategy.Parallel);
        expect(cfg.providers).toEqual(entries);
        expect(cfg.strategy).toBe(ProviderStrategy.Parallel);
    });

    it('keeps env-resolved strategy when the multi-provider constructor omits it', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY = 'fallback';
        const cfg = new WebSearchConfiguration([
            { provider: WebSearchProvider.ExaAI, apiKey: 'k' }
        ]);
        expect(cfg.strategy).toBe(ProviderStrategy.Fallback);
    });

    it('prefers explicit constructor entries over the providers env var', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'tavily';
        const entries: ProviderEntry[] = [{ provider: WebSearchProvider.ExaAI, apiKey: 'k' }];
        const cfg = new WebSearchConfiguration(entries);
        expect(cfg.providers).toEqual(entries);
    });

    it('resolves providers from env when constructed with an empty array', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'tavily,duckduckgo';
        process.env.LLM_CHAT_WEB_SEARCH_TAVILY_API_KEY = 'tv-key';
        const cfg = new WebSearchConfiguration([]);
        expect(cfg.providers).toEqual([
            { provider: WebSearchProvider.Tavily, apiKey: 'tv-key' },
            { provider: WebSearchProvider.DuckDuckGo }
        ]);
    });

    it('resolves a tavily entry with its dedicated key from env', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'tavily';
        process.env.LLM_CHAT_WEB_SEARCH_TAVILY_API_KEY = 'tv-key';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers).toEqual([{ provider: WebSearchProvider.Tavily, apiKey: 'tv-key' }]);
    });

    it('parses comma-separated provider names, trims whitespace, and skips empties', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = ' tavily , ,exaai ';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers.map((entry) => entry.provider)).toEqual([
            WebSearchProvider.Tavily,
            WebSearchProvider.ExaAI
        ]);
    });

    it('skips unknown provider names instead of mapping them to another backend', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'nope,tavily';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers.map((entry) => entry.provider)).toEqual([WebSearchProvider.Tavily]);
    });

    it('falls back to the duckduckgo default entry when all names are unknown', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'nope,nada';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers).toEqual([{ provider: WebSearchProvider.DuckDuckGo }]);
    });

    it('reads the ExaAI per-provider key', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'exaai';
        process.env.LLM_CHAT_WEB_SEARCH_EXAAI_API_KEY = 'ex-key';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers[0]!.apiKey).toBe('ex-key');
    });

    it('reads the Firecrawl per-provider key', () => {
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'firecrawl';
        process.env.LLM_CHAT_WEB_SEARCH_FIRECRAWL_API_KEY = 'fc-key';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers[0]!.apiKey).toBe('fc-key');
    });

    it('leaves apiKey undefined when no per-provider key is set', () => {
        delete process.env.LLM_CHAT_WEB_SEARCH_TAVILY_API_KEY;
        process.env.LLM_CHAT_WEB_SEARCH_PROVIDERS = 'tavily';
        const cfg = new WebSearchConfiguration();
        expect(cfg.providers[0]).toEqual({ provider: WebSearchProvider.Tavily });
    });
});
