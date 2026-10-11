# Usage

## WebToolsPackage

Both tools can be registered together as a single `ToolPackage`:

```typescript
import { WebToolsPackage } from '@johannes.latzel/llm-chat-web';

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
    new WebSearchConfiguration(),
    new WebFetchConfiguration()
);
suite.add(pkg);
```

Individual configs can be overridden while others stay at defaults by omitting the argument:

```typescript
const pkg = new WebToolsPackage(
    new WebSearchConfiguration(WebSearchProvider.Tavily, 'key')
);
```

## WebSearchTool (tool name: `web_search`)

Search the web using DuckDuckGo, Tavily, ExaAI, or Firecrawl. Accepts one or more queries; each query returns its own independent result in the chain.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `queries` | `string[]` | yes | Array of search queries |
| `max_results` | `number` | no | Max results to return per query (default: config default, max: 20) |
| `max_chars_per_result` | `number` | no | Max chars per result snippet (default: config default, max: 50000) |

### Returns

Each query produces its own result:

```text
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
console.log(result[0].result);
```

### Multiple Queries

```typescript
const result = await tool.execute({ queries: ['AI news', 'space news'] });
// result[0] -> search results for "AI news"
// result[1] -> search results for "space news"
```

### Override Parameters Per-Call

```typescript
const result = await tool.execute({
    queries: ['TypeScript 6.0 features'],
    max_results: 3,
    max_chars_per_result: 500
});
```

### Switch Provider

```typescript
import { WebSearchTool, WebSearchConfiguration, WebSearchProvider } from '@johannes.latzel/llm-chat-web';

const exaConfig = new WebSearchConfiguration(WebSearchProvider.ExaAI, 'your-exa-key');
const exaTool = new WebSearchTool(exaConfig);

const ddgConfig = new WebSearchConfiguration(WebSearchProvider.DuckDuckGo);
const ddgTool = new WebSearchTool(ddgConfig);

const fcConfig = new WebSearchConfiguration(WebSearchProvider.Firecrawl, 'your-firecrawl-key');
const fcTool = new WebSearchTool(fcConfig);
```

### Provider notes

| Provider | API Key | Rate Limits | Notes |
|---|---|---|---|
| **DuckDuckGo** | Not needed | None (HTML scraping) | Subject to anti-bot challenge pages; retries with backoff (max 2) and concurrency capped at 1 |
| **Tavily** | Required | Varies by plan | |
| **ExaAI** | Required | Varies by plan | |
| **Firecrawl** | Required (prefix: `fc-`) | Varies by plan | Search via `/v2/search` endpoint |

## WebFetchTool (tool name: `web_fetch`)

Fetch one or more URLs in parallel and return their content as clean text. Each URL produces its own independent result.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | `string[]` | yes | Array of URLs to fetch |
| `max_chars` | `number` | no | Override max characters returned per URL (clamped to `[1, maxCharsPerFetchLimit]`) |
| `maxPages` | `number` | no | Max pages to extract from a paginated document (currently only PDF); must be a positive integer and no greater than `maxPdfPages`, otherwise the call fails |

### Returns

Each URL produces its own result:

```text
Page Title

Extracted text content...
URL: https://final-url-after-redirects
```

### Basic fetch

```typescript
import { WebFetchTool, WebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebFetchTool(new WebFetchConfiguration());
const result = await tool.execute({ urls: ['https://example.com/article'] });
console.log(result[0].result);
```

### Multiple URLs

```typescript
const result = await tool.execute({ urls: ['https://example.com/a', 'https://example.com/b'] });
// result[0] -> content for first URL
// result[1] -> content for second URL
```

### Custom character limit

```typescript
const result = await tool.execute({ urls: ['https://example.com'], max_chars: 500 });
```

### Content-type handling

The tool dispatches the response content type to a registered handler from the `ContentHandlerRegistry`:

| Content type | Handling |
|---|---|
| `text/html` | Extracted with Readability (clean text) |
| `application/json` | Pretty-printed with indentation |
| `application/xml` / `text/xml` | Returned as-is |
| `text/csv` | Returned as-is |
| `text/markdown` | Returned as-is |
| `text/plain` | Returned as-is |
| `application/pdf` / `application/x-pdf` | Text layer extracted with PDF.js (no OCR); a scanned/image-only PDF returns an explanatory message; page and character truncation are noted in the output |
| Other `text/*` | Returned as-is |
| Other types | Rejected with "Unsupported content type" |

See [architecture](architecture.md#content-type-handler-dispatch) for the dispatch mechanism. To supply custom handlers that take priority over the built-in defaults:

```typescript
import { ResultStatus } from '@johannes.latzel/llm-chat';
import {
    WebFetchTool,
    WebFetchConfiguration,
    ContentHandlerRegistry
} from '@johannes.latzel/llm-chat-web';

const registry = new ContentHandlerRegistry();
registry.register({
    name: 'my-handler',
    match: (ct) => ct.startsWith('text/html'),
    handle: (body, url, responseUrl, options) => {
        const text = new TextDecoder().decode(body);
        return { result: text.slice(0, options.maxChars), status: ResultStatus.Success };
    }
});
// Registering a custom handler replaces the built-in defaults entirely.

const tool = new WebFetchTool(new WebFetchConfiguration(), registry);
```

### Header rules

`WebFetchConfiguration.headerRules` injects headers for matching URLs. Each rule is a glob pattern matched against the full URL. Matching rules are merged from least specific to most specific, so a more specific rule overrides a less specific one for the same header name:

```typescript
import { WebFetchConfiguration, WebFetchTool } from '@johannes.latzel/llm-chat-web';

const config = new WebFetchConfiguration();
config.headerRules = [
    { pattern: 'https://api.example.com/**', headers: { Accept: 'application/json' } },
    { pattern: 'https://api.example.com/v2/**', headers: { Authorization: 'Bearer token' } }
];

const tool = new WebFetchTool(config);
```

Resolved headers are sent on both the content-length `HEAD` probe and the `GET` request. There is no model-facing headers parameter: only the host configures rules.

### JSON pretty-printing

Valid JSON responses are parsed and re-serialized with indentation for readability. If the response body is not valid JSON, the tool returns an error.

### Content extraction

See [architecture](architecture.md#content-extraction) for the full HTML extraction pipeline. In short: JSDOM parses the page, Mozilla Readability extracts the article, and content selectors serve as fallback.

### Truncation

When content exceeds `max_chars`, the tool truncates at the nearest boundary: paragraph break, sentence break, word break, or hard character cut. A `[truncated]` marker is appended, followed by a character-count hint such as `[PDF text truncated to 50 of 500 characters]` (the label names the content type). See [architecture](architecture.md#truncation) for the detailed algorithm.

### Content-size guard

Before downloading, the tool sends a `HEAD` request to check `Content-Length`. If the declared size exceeds `maxContentLengthBytes`, the request is rejected immediately. See [architecture](architecture.md#content-size-guard) for details.

## Error Handling

Tools never throw; errors are returned in the result:

```typescript
const result = await tool.execute({ queries: ['something'] });
if (result[0].status === 'error') {
    console.error('Search failed:', result[0].result);
    return;
}
console.log(result[0].result);
```
