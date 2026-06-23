# Environment Variables

All variables are optional. Constructor parameters take precedence over environment variables.

| Variable | Default | Description |
|---|---|---|
| `LLM_CHAT_WEB_SEARCH_PROVIDER` | `duckduckgo` | `tavily`, `exaai`, or `duckduckgo` |
| `LLM_CHAT_WEB_SEARCH_API_KEY` | — | API key (used by Tavily and ExaAI) |
| `LLM_CHAT_WEB_SEARCH_MAX_RESULTS` | `5` | Default result count per search |
| `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT` | `2000` | Max characters per result snippet |
| `LLM_CHAT_WEB_SEARCH_CONCURRENCY` | `3` | Concurrency limit for parallel searches |
| `LLM_CHAT_WEB_FETCH_CONCURRENCY` | `3` | Concurrency limit for parallel URL fetches |
| `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH` | `10000` | Default max characters per URL fetch |
| `LLM_CHAT_WEB_MAX_CHARS_PER_FETCH_LIMIT` | `100000` | Hard limit for per-request `max_chars` override |
| `LLM_CHAT_WEB_FETCH_TIMEOUT_MS` | `5000` | Timeout in ms for URL fetch requests |
| `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS` | `4000` | Timeout in ms for search API requests |
| `LLM_CHAT_WEB_MAX_CONTENT_LENGTH_BYTES` | `10000000` | Max bytes accepted before rejecting the fetch (checked via HEAD) |

## WebSearchConfiguration

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
| `concurrency` | `number` | `3` | `LLM_CHAT_WEB_SEARCH_CONCURRENCY` | Concurrency limit for parallel searches |

## WebFetchConfiguration

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
| `concurrency` | `number` | `3` | `LLM_CHAT_WEB_FETCH_CONCURRENCY` | Concurrency limit for parallel URL fetches |
