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

You can also override individual configs while leaving others at defaults by omitting the argument:

```typescript
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
```

### Provider notes

| Provider | API Key | Rate Limits |
|---|---|---|
| **DuckDuckGo** | Not needed | None (HTML scraping) |
| **Tavily** | Required | Varies by plan |
| **ExaAI** | Required | Varies by plan |

## WebFetchTool (tool name: `web_fetch`)

Fetch one or more URLs in parallel and return their content as clean text. Each URL produces its own independent result.

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | `string[]` | yes | Array of URLs to fetch |
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

The tool dispatches the response content type to a registered handler from `FetchRegistry`:

| Content type | Handling |
|---|---|
| `text/html` | Extracted with Readability (clean text) |
| `application/json` | Pretty-printed with indentation |
| `application/xml` / `text/xml` | Returned as-is |
| `text/csv` | Returned as-is |
| `text/markdown` | Returned as-is |
| `text/plain` | Returned as-is |
| Other `text/*` | Returned as-is |
| Other types | Rejected with "Unsupported content type" |

See [architecture](architecture.md#content-type-handler-dispatch) for the dispatch mechanism. To supply custom handlers that take priority over the built-in defaults:

```typescript
import { WebFetchTool, WebFetchConfiguration, FetchRegistry, ResultStatus } from '@johannes.latzel/llm-chat-web';

const registry = new FetchRegistry();
registry.register({
    name: 'my-handler',
    match: (ct) => ct.startsWith('text/html'),
    handle: (body, url, responseUrl, maxChars) => {
        return { result: body, status: ResultStatus.Success };
    }
});
// Built-in defaults are NOT added since a handler is already registered.
// Call registry.init() to append defaults after your custom handler.

const tool = new WebFetchTool(new WebFetchConfiguration(), registry);
```

### JSON pretty-printing

Valid JSON responses are parsed and re-serialized with indentation for readability. If the response body is not valid JSON, the tool returns an error.

### Content extraction

See [architecture](architecture.md#content-extraction) for the full HTML extraction pipeline. In short: JSDOM parses the page, Mozilla Readability extracts the article, and content selectors serve as fallback.

### Truncation

When content exceeds `max_chars`, the tool truncates at the nearest boundary — paragraph break, sentence break, word break, or hard character cut. A `... [truncated]` marker is appended. See [architecture](architecture.md#truncation) for the detailed algorithm.

### Content-size guard

Before downloading, the tool sends a `HEAD` request to check `Content-Length`. If the declared size exceeds `maxContentLengthBytes`, the request is rejected immediately. See [architecture](architecture.md#content-size-guard) for details.

## Error Handling

Tools never throw — errors are returned in the result:

```typescript
const result = await tool.execute({ queries: ['something'] });
if (result[0].status === 'error') {
    console.error('Search failed:', result[0].result);
    return;
}
console.log(result[0].result);
```
