# Usage

## WebToolsPackage

Both tools can be registered together as a single `ToolPackage`:

```typescript
import { WebToolsPackage } from '@johannes.latzel/llm-chat-web';

// Register with a ToolSuite
suite.add(new WebToolsPackage());
// Registers: web_search, web_fetch
```

The package constructor accepts optional configuration per tool. If omitted, each config defaults to its environment-variable defaults:

```typescript
import {
    WebToolsPackage,
    WebSearchConfiguration,
    WebFetchConfiguration
} from '@johannes.latzel/llm-chat-web';

const pkg = new WebToolsPackage(
    new WebSearchConfiguration(),                     // optional
    new WebFetchConfiguration()                       // optional
);
suite.add(pkg);
```

You can also override individual configs while leaving others at defaults by omitting the argument:

```typescript
// Only override search config, use defaults for fetch
const pkg = new WebToolsPackage(
    new WebSearchConfiguration(WebSearchProvider.Tavily, 'key')
);
```

## WebSearchTool (tool name: `web_search`)

Search the web using DuckDuckGo, Tavily, or ExaAI. Accepts one or more queries — each query returns its own independent result in the chain.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `queries` | `string[]` | yes | Array of search queries |
| `max_results` | `number` | no | Max results to return per query (default: config default, max: 20) |
| `max_chars_per_result` | `number` | no | Max chars per result snippet (default: config default, max: 50000) |

### Returns

Each query produces its own result:

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
const result = await tool.execute({ queries: ['latest AI news'] });
// result[0].result contains the search results
```

### Multiple Queries

```typescript
const result = await tool.execute({ queries: ['AI news', 'space news'] });
// result[0] -> search results for "AI news"
// result[1] -> search results for "space news"
// Each result has its own status (success or error)
```

### Override Parameters Per-Call

Each `execute()` call accepts optional `max_results` and `max_chars_per_result` that override the config defaults for all queries.

```typescript
const result = await tool.execute({
    queries: ['TypeScript 6.0 features'],
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
const result = await tool.execute({ queries: ['something'] });
if (result[0].status === 'error') {
    console.error('Search failed:', result[0].result);
    return;
}
console.log(result[0].result);
```

## WebFetchTool (tool name: `web_fetch`)

Fetch one or more URLs in parallel and return their content as clean text (or raw). Each URL produces its own independent result.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | `string[]` | yes | Array of URLs to fetch |
| `raw` | `boolean` | no | Return raw response instead of extracted text per URL (default: `false`) |
| `max_chars` | `number` | no | Override max characters returned per URL (clamped to `[1, maxCharsPerFetchLimit]`) |

### Returns

Each URL produces its own result:

```
Page Title

Extracted text content...
URL: https://final-url-after-redirects
```

### Basic fetch

```typescript
import { WebFetchTool, WebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebFetchTool(new WebFetchConfiguration());
const result = await tool.execute({ urls: ['https://example.com/article'] });
// result[0].result contains the title, extracted text, and final URL
```

### Multiple URLs

```typescript
const result = await tool.execute({ urls: ['https://example.com/a', 'https://example.com/b'] });
// result[0] -> content for first URL
// result[1] -> content for second URL
// Each result has its own status (success or error)
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
const result = await tool.execute({ urls: ['https://example.com/doc.pdf'] });
// result[0].result === "https://example.com/doc.pdf: Unsupported content type: application/pdf. Only HTML and plain text are supported."
```

### Examples

```typescript
// Raw HTML
const raw = await tool.execute({ urls: ['https://example.com'], raw: true });

// Custom character limit
const limited = await tool.execute({ urls: ['https://example.com'], max_chars: 500 });

// Multiple URLs with independent error handling
const multi = await tool.execute({ urls: ['https://a.com', 'https://b.com', 'https://c.com'] });
```
