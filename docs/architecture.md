# Architecture

## Overview

`@johannes.latzel/llm-chat-web` extends the `llm-chat` framework with web search and URL fetching tools: three search providers (DuckDuckGo, Tavily, ExaAI), HTML content extraction via Mozilla Readability, configurable content-type dispatch, and size-limited fetches with concurrency control.


## Design

### Tool classes

Each tool extends `Tool` from `@johannes.latzel/llm-chat`. Both accept arrays of inputs (`queries` for search, `urls` for fetch) and return chained `PartialToolResult` results via `ResultBuilder.from(results).build()`. `p-map` manages concurrency with per-tool limits.

All errors are caught and returned as plain-string messages; tools never throw.

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

Provider selection is a constructor-time decision. `WebSearchConfiguration` takes a `WebSearchProvider` enum value, and `WebSearchTool` constructs the corresponding provider internally. Search provider classes are not part of the public API.

### WebSearchTool specifics

The tool constructs the right provider based on configuration and delegates each query independently. Timeouts and headers use the shared HTTP client.

### WebFetchTool specifics

#### Content extraction

`extractText(html, url?)` processes HTML through a pipeline:

1. **Parse** with `JSDOM`
2. **Strip** `<script>`, `<style>`, `<noscript>`, `<iframe>` from the DOM
3. **Gate** with `isProbablyReaderable()`: if false, skip Readability
4. **Extract** with `Readability.parse()`: if result is < ~100 chars, fall through
5. **Fallback** probe content selectors: `article`, `main`, `[role="main"]`, `.post-content`, `.entry-content`, `.content`. If none match, use `document.body.textContent`.

Returns `{ title, textContent, content, excerpt, byline, siteName }`.

#### Truncation

When content exceeds `max_chars`, the truncation algorithm walks down boundary types:

1. **Paragraph break** (`\n\n`): cuts at the last paragraph break within the budget window
2. **Sentence break** (`.`, `!`, `?`): cuts at the last sentence-ending punctuation
3. **Word break** (last space): guarantees no mid-word cuts
4. **Hard cut**: last resort, only when no boundary is found

The `[truncated]` marker is included in the character budget. Its prefix depends on the boundary used: `\n\n[truncated]` after a paragraph break, ` [truncated]` after a sentence break or hard cut, and ` ...[truncated]` after a word break.

#### Content-size guard

Before downloading, the tool sends a `HEAD` request to check `Content-Length`. If it exceeds the configured limit, the fetch is rejected immediately.

#### Content-type handler dispatch

When a response is received, `WebFetchTool` looks up the `Content-Type` header in a `FetchRegistry`: a list of `ContentHandler` instances checked in registration order. The first handler whose `match()` returns `true` processes the body via `handle()`.

`WebFetchTool` creates its own `FetchRegistry` if none is provided and calls `init()` in its constructor. Built-in defaults are populated only if no custom handlers were registered beforehand, so a registry with custom handlers takes priority over the built-in set (see [usage](usage.md#content-type-handling) for the handler table and examples).

## Dependencies

- `@johannes.latzel/llm-chat`: framework providing `Tool`, `ToolParameters`, `ResultStatus`, `ResultBuilder`, etc.
- `@mozilla/readability`: article content extraction
- `jsdom`: server-side DOM for Readability integration
- `p-map`: concurrency-limited parallel execution
