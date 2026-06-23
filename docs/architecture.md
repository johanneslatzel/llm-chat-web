# Architecture

## Overview

`@johannes.latzel/llm-chat-web` extends the `llm-chat` framework with web search and URL fetching tools — supporting three search providers (DuckDuckGo, Tavily, ExaAI), HTML content extraction via Mozilla Readability, configurable content-type dispatch, and size-limited fetches with concurrency control.


## Design

### Tool classes

Each tool extends `Tool` from `@johannes.latzel/llm-chat`. Both accept arrays of inputs (`queries` for search, `urls` for fetch) and return chained `PartialToolResult` results via `ResultBuilder.from(results).build()`. `p-map` manages concurrency with per-tool limits.

All errors are caught and returned as plain-string messages — tools never throw.

### WebToolsPackage

The package bundles `WebSearchTool` and `WebFetchTool` into a single `ToolPackage`. It accepts optional per-tool configurations; omitted configs default to environment-variable values.

### HTTP client

`fetchWithTimeout(url, options?)` wraps native `fetch()`:

- **Timeout**: `AbortSignal.timeout(ms)`
- **User-Agent**: constant `llm-chat-web`
- **Custom headers**: overridable via `SearchProvider.headers()`

### Search providers

The search tool delegates to one of three providers, each implementing the abstract `SearchProvider` class:

```typescript
abstract class SearchProvider {
    protected headers: Record<string, string>;
    abstract search(query: string, maxResults: number, maxCharsPerResult: number): Promise<WebSearchResult[]>;
}
```

| Provider | Class | Auth | Method |
|---|---|---|---|
| DuckDuckGo | `DuckDuckGoProvider` | None | HTML scraping |
| Tavily | `TavilyProvider` | API key | REST API (POST, Bearer token) |
| ExaAI | `ExaAIProvider` | API key | REST API (POST, Bearer token) |

Providers that require an API key extend `ApiKeySearchProvider`, which adds `Content-Type` and `Authorization` headers and provides a `postJson()` convenience method.

To implement a custom provider, extend `SearchProvider` (or `ApiKeySearchProvider`) and implement `search()`. The provider is then injected via `WebSearchConfiguration`:

```typescript
import { SearchProvider, WebSearchConfiguration, WebSearchTool, type WebSearchResult } from '@johannes.latzel/llm-chat-web';

class MyProvider extends SearchProvider {
    async search(query: string, maxResults: number, maxCharsPerResult: number): Promise<WebSearchResult[]> {
        const response = await this.fetchUrl('https://api.example.com/search', 'MyProvider', {
            method: 'POST',
            body: JSON.stringify({ query, maxResults })
        });
        const data = await response.json();
        return data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.snippet.slice(0, maxCharsPerResult),
        }));
    }
}

const config = new WebSearchConfiguration(new MyProvider(5000));
const tool = new WebSearchTool(config);
```

### WebSearchTool specifics

The tool constructs the right provider based on configuration and delegates each query independently. Timeouts and headers use the shared HTTP client.

### WebFetchTool specifics

#### Content extraction

`extractText(html, url?)` processes HTML through a pipeline:

1. **Parse** with `JSDOM`
2. **Strip** `<script>`, `<style>`, `<noscript>`, `<iframe>` from the DOM
3. **Gate** with `isProbablyReaderable()` — if false, skip Readability
4. **Extract** with `Readability.parse()` — if result is < ~100 chars, fall through
5. **Fallback** probe content selectors: `article`, `main`, `[role="main"]`, `.post-content`, `.entry-content`, `.content`. If none match, use `document.body.textContent`.

Returns `{ title, textContent, content, excerpt, byline, siteName }`.

#### Truncation

When content exceeds `max_chars`, the truncation algorithm walks down boundary types:

1. **Paragraph break** (`\n\n`) — if found in the latter half of the budget window
2. **Sentence break** (`. `) — if found past 30% of the budget
3. **Word break** (last space) — guarantees no mid-word cuts
4. **Hard cut** — last resort, only when no boundary is found

A `... [truncated]` marker is appended (included in the character budget).

#### Content-size guard

Before downloading, the tool sends a `HEAD` request to check `Content-Length`. If it exceeds the configured limit, the fetch is rejected immediately.

#### Content-type handler dispatch

When a response is received, `WebFetchTool` looks up the `Content-Type` header in a `FetchRegistry` — a list of `ContentHandler` instances checked in registration order. The first handler whose `match()` returns `true` processes the body via `handle()`.

`WebFetchTool` creates its own `FetchRegistry` if none is provided. The registry is lazy-initialized: `init()` is called on the first fetch, and built-in defaults are populated only if no custom handlers were registered beforehand. This lets you supply a registry with custom handlers that take priority (see [usage](usage.md#content-type-handling) for the handler table and examples).

## Dependencies

- `@johannes.latzel/llm-chat` — framework providing `Tool`, `ToolParameters`, `ResultStatus`, `ResultBuilder`, etc.
- `@mozilla/readability` — article content extraction
- `jsdom` — server-side DOM for Readability integration
- `p-map` — concurrency-limited parallel execution
