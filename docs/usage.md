# Usage

## WebSearchTool (tool name: `web_search`)

Search the web using DuckDuckGo, Tavily, or ExaAI.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | yes | The search query |
| `max_results` | `number` | no | Max results to return (default: config default, max: 20) |
| `max_chars_per_result` | `number` | no | Max chars per result snippet (default: config default, max: 50000) |

### Returns

```
Search results for "query":

[1] Title
    URL: https://example.com
    Snippet text...
```

### Basic Search

```typescript
import { WebSearchTool, WebSearchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebSearchTool(new WebSearchConfiguration(WebSearchProvider.Tavily, 'your-tavily-key'));
const result = await tool.execute({ query: 'latest AI news' });
```

### Override Parameters Per-Query

Each `execute()` call accepts optional `max_results` and `max_chars_per_result` that override the config defaults for that search only.

```typescript
const result = await tool.execute({
    query: 'TypeScript 6.0 features',
    max_results: 3,
    max_chars_per_result: 500
});
```

### Switch Provider

Pass a provider to the config:

```typescript
import { WebSearchTool, WebSearchConfiguration, WebSearchProvider } from '@johannes.latzel/llm-chat-web';

// ExaAI
const exaConfig = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'your-exa-key');
const exaTool = new WebSearchTool(exaConfig);

// DuckDuckGo (no API key)
const ddgConfig = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
const ddgTool = new WebSearchTool(ddgConfig);
```

### Provider notes

| Provider | API Key | Rate Limits |
|---|---|---|
| **DuckDuckGo** | Not needed | None (HTML scraping) |
| **Tavily** | Required | Varies by plan |
| **ExaAI** | Required | Varies by plan |

## Error Handling

The tool never throws — errors are returned in the result:

```typescript
const result = await tool.execute({ query: 'something' });
if (result.status === 'error') {
    console.error('Search failed:', result.result);
    return;
}
console.log(result.result);
```

## WebFetchTool (tool name: `web_fetch`)

Fetch a URL and return its content as clean text (or raw HTML).

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | yes | The URL to fetch |
| `raw` | `boolean` | no | Return raw HTML instead of extracted text (default: `false`) |
| `max_chars` | `number` | no | Override max characters returned (clamped to `[1, maxCharsPerFetchLimit]`) |

### Returns

```
Page Title

Extracted text content...
URL: https://final-url-after-redirects
```

### Basic fetch

```typescript
import { WebFetchTool, WebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebFetchTool(new WebFetchConfiguration());
const result = await tool.execute({ url: 'https://example.com/article' });
// result.result contains the title, extracted text, and final URL
```

### Content extraction

By default, the tool converts HTML to clean text:

1. Parses HTML with `JSDOM`
2. Strips `<script>`, `<style>`, `<noscript>`, `<iframe>`
3. Runs Mozilla's Readability to extract article content
4. Falls back to CSS selectors (`article`, `main`, `[role="main"]`, etc.) if Readability returns nothing useful
5. Last resort: uses `document.body.textContent`

### Truncation

If the extracted content exceeds `max_chars`, it is truncated at the nearest boundary — paragraph break → sentence break → word break → hard character cut. A `... [truncated]` marker is appended.

### Raw mode

Pass `raw: true` to return the raw response body instead of extracted text. Raw mode accepts any content type and skips the content-type guard — useful for JSON APIs, XML, or other text-based formats.

### Content-size guard

Before downloading the full response, the tool sends a `HEAD` request to check the `Content-Length` header. If the declared size exceeds `maxContentLengthBytes`, the request is rejected immediately without downloading.

### Content-type guard

Non-HTML and non-plain-text content (PDFs, images, etc.) are rejected with an error.

```typescript
const result = await tool.execute({ url: 'https://example.com/doc.pdf' });
// result.result === "Unsupported content type: application/pdf. Only HTML and plain text are supported."
```

### Examples

```typescript
// Raw HTML
const raw = await tool.execute({ url: 'https://example.com', raw: true });

// Custom character limit
const limited = await tool.execute({ url: 'https://example.com', max_chars: 500 });
```

## BatchWebFetchTool (tool name: `batch_web_fetch`)

Fetches multiple URLs in parallel and returns their content as clean text. Uses [`p-map`](https://github.com/sindresorhus/p-map) for concurrency control.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | `string` (JSON array) | yes | JSON array of URLs, e.g. `'["https://a.com", "https://b.com"]'` |
| `max_chars` | `number` | no | Max characters per URL (default: config default, max: 100000) |
| `raw` | `boolean` | no | Return raw response instead of extracted text per URL (default: `false`) |
| `concurrency` | `number` | no | Max concurrent fetches (default: config default, max: 10) |

### Returns

```
Batch fetch complete: 2/3 URLs succeeded, 1 failed.

[1] https://example.com/a
Page Title

Extracted text...
URL: https://example.com/a

---

[2] https://example.com/b
Page Title

Extracted text...
URL: https://example.com/b

---

[3] https://example.com/c
Error: HTTP error 404: Not Found
```

Each URL is fetched independently — a failure in one does not affect the others. Status is `success` if at least one URL succeeds, `error` if all fail.

### Basic batch fetch

```typescript
import { BatchWebFetchTool, BatchWebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new BatchWebFetchTool(new BatchWebFetchConfiguration());
const result = await tool.execute({
    urls: '["https://example.com/article", "https://example.org/doc"]'
});
```

### Override concurrency

```typescript
const result = await tool.execute({
    urls: '["https://a.com", "https://b.com", "https://c.com"]',
    concurrency: 5
});
```

Each URL uses the same fetch pipeline as `WebFetchTool` (content-size guard via HEAD, content-type guard, Readability extraction, truncation).
