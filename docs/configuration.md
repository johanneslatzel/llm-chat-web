# Environment Variables

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LLM_CHAT_WEB_SEARCH_PROVIDER` | `duckduckgo` | `tavily`, `exaai`, or `duckduckgo` |
| `LLM_CHAT_WEB_SEARCH_API_KEY` | — | API key (used by Tavily and ExaAI) |
| `LLM_CHAT_WEB_SEARCH_MAX_RESULTS` | `5` | Default result count per search |
| `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT` | `2000` | Max characters per result snippet |
| `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH` | `10000` | Default max characters per URL fetch |
| `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT` | `100000` | Hard limit for per-request `max_chars` override |
| `LLM_CHAT_WEB_FETCH_TIMEOUT_MS` | `5000` | Timeout in ms for URL fetch requests |
| `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS` | `4000` | Timeout in ms for search API requests |
| `LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES` | `10000000` | Max bytes accepted before rejecting the fetch (checked via HEAD) |
| `LLM_CHAT_WEB_BATCH_FETCH_CONCURRENCY` | `3` | Default concurrency for batch fetches |
| `LLM_CHAT_WEB_BATCH_FETCH_MAX_CONCURRENCY` | `10` | Hard limit for per-request `concurrency` override |

## WebSearchConfiguration

Configuration for the `WebSearchTool`.

### Constructor

```typescript
new WebSearchConfiguration(provider?: WebSearchProvider, apiKey?: string)
```

If omitted, values are read from environment variables. DuckDuckGo is the default provider.

### Properties

| Property | Type | Default | Env Variable | Description |
|---|---|---|---|---|
| `apiKey` | `string` | `''` | `LLM_CHAT_WEB_SEARCH_API_KEY` | API key for Tavily/ExaAI |
| `provider` | `WebSearchProvider` | `DuckDuckGo` | `LLM_CHAT_WEB_SEARCH_PROVIDER` | `duckduckgo`, `tavily`, or `exaai` |
| `maxResults` | `number` | `5` | `LLM_CHAT_WEB_SEARCH_MAX_RESULTS` | Default result count per search |
| `maxCharsPerResult` | `number` | `2000` | `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT` | Default max chars per result snippet |
| `searchTimeoutMs` | `number` | `4000` | `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS` | Timeout in ms for search API requests |

## WebFetchConfiguration

Configuration for the `WebFetchTool`.

### Constructor

```typescript
new WebFetchConfiguration()
```

All values are read from environment variables.

### Properties

| Property | Type | Default | Env Variable | Description |
|---|---|---|---|---|
| `maxCharsPerFetch` | `number` | `10000` | `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH` | Default max chars per URL fetch |
| `maxCharsPerFetchLimit` | `number` | `100000` | `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT` | Hard limit for per-request `max_chars` override |
| `fetchTimeoutMs` | `number` | `5000` | `LLM_CHAT_WEB_FETCH_TIMEOUT_MS` | Timeout in ms for URL fetch requests |
| `maxContentLengthBytes` | `number` | `10000000` | `LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES` | Max bytes accepted before rejecting the fetch |

## BatchWebFetchConfiguration

Configuration for the `BatchWebFetchTool`.

### Constructor

```typescript
new BatchWebFetchConfiguration(fetchConfig?: WebFetchConfiguration)
```

If `fetchConfig` is omitted, a default `WebFetchConfiguration` is created (reading from environment variables).

### Properties

| Property | Type | Default | Env Variable | Description |
|---|---|---|---|---|
| `fetchConfig` | `WebFetchConfiguration` | — | — | Wrapped fetch config for per-URL limits |
| `concurrency` | `number` | `3` | `LLM_CHAT_WEB_BATCH_FETCH_CONCURRENCY` | Default concurrency for batch fetches |
| `maxConcurrency` | `number` | `10` | `LLM_CHAT_WEB_BATCH_FETCH_MAX_CONCURRENCY` | Hard limit for per-request `concurrency` override |

