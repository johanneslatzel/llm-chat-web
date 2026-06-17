# Architecture

## Overview

`@johannes.latzel/llm-chat-web` is a `ToolPackage` that extends the `llm-chat` framework with web search and URL fetching tools.

## Search providers

// describe search providers and how to implement a custom provider

## Design

### ToolPackage

The `WebToolsPackage` class bundles `WebSearchTool` and `WebFetchTool` into a single `ToolPackage` (from `@johannes.latzel/llm-chat`). Register it with a `ToolSuite` via `suite.add(new WebToolsPackage())` to register both tools at once. The package accepts optional per-tool configurations; omitted configs default to environment-variable values.

### Tools

Each tool implements the abstract `Tool` from `@johannes.latzel/llm-chat`. Both tools accept arrays of inputs (`queries` for search, `urls` for fetch) and return chained `PartialToolResult` results via `ResultBuilder.from(results).build()`. Concurrency is managed by `p-map` with configurable limits per tool.

### HTTP client

`fetchWithTimeout(url, options?)` wraps native `fetch()` with:

- **Timeout**: uses `AbortSignal.timeout(ms)`
- **User-Agent**: custom constant `llm-chat-web`, set via headers
- **Custom headers**: override `SearchProvider.headers()`

### Configuration

Each tool has its own configuration class:
    - `web_search` uses `WebSearchConfiguration` (provider, API key, search-specific limits, concurrency)
    - `web_fetch` uses `WebFetchConfiguration` (fetch-specific limits, timeouts, concurrency)
All read from environment variables by default.

---

### WebSearchTool specifics

The search tool delegates to one of three providers — DuckDuckGo (HTML scraping), Tavily (REST API), or ExaAI (REST API) — each with its own request format and response parsing. All three use `AbortSignal.timeout(ms)` from the shared HTTP client.

---

### WebFetchTool specifics

#### Content extraction

`extractText(html, url?)` processes HTML through a pipeline:

1. **Parse** with `JSDOM`
2. **Strip** `<script>`, `<style>`, `<noscript>`, `<iframe>` from the DOM
3. **Gate** with `isProbablyReaderable()` — if false, skip Readability
4. **Extract** with `Readability.parse()` — if result is `< ~100 chars`, fall through
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

#### Content-type guard

Non-HTML/plain-text responses (PDFs, images, etc.) are rejected with a clear error message. This check is skipped in raw mode — any content type is accepted.

## Result types

### WebSearchResult

```typescript
type WebSearchResult = {
    title: string;
    url: string;
    content: string;
    score?: number;
};
```

### WebFetchResult

```typescript
type WebFetchResult = {
    title: string;
    url: string;
    content: string;
    contentType: string;
};
```

## Dependencies

- `@johannes.latzel/llm-chat` — framework providing `Tool`, `ToolParameters`, `ResultStatus`, `ResultBuilder`, etc.
- `@mozilla/readability` — article content extraction
- `jsdom` — server-side DOM for Readability integration
- `p-map` — concurrency-limited parallel execution
