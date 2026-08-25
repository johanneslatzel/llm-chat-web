# Environment Variables

All variables are optional. Constructor parameters take precedence over environment variables.

| Variable | Default | Description |
|---|---|---|
| `LLM_CHAT_WEB_SEARCH_PROVIDERS` | — | Comma-separated provider list, e.g. `duckduckgo,tavily`. Unset or empty resolves to a single keyless `duckduckgo` entry. Unknown names are skipped |
| `LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY` | `single` | How multiple providers are combined: `single`, `parallel`, `fallback`, `weighted_random`, or `round_robin` |
| `LLM_CHAT_WEB_SEARCH_TAVILY_API_KEY` | — | Per-provider API key for Tavily |
| `LLM_CHAT_WEB_SEARCH_EXAAI_API_KEY` | — | Per-provider API key for ExaAI |
| `LLM_CHAT_WEB_SEARCH_FIRECRAWL_API_KEY` | — | Per-provider API key for Firecrawl |
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
new WebSearchConfiguration(providers?: ProviderEntry[], strategy?: ProviderStrategy)
```

An omitted or empty `providers` array triggers environment resolution (see [Multi-provider mode](#multi-provider-mode)). An explicit `strategy` overrides the environment value.

### Properties

| Property | Type | Default | Env Variable | Description |
|---|---|---|---|---|
| `strategy` | `ProviderStrategy` | `Single` | `LLM_CHAT_WEB_SEARCH_PROVIDER_STRATEGY` | How multiple providers are combined |
| `providers` | `ProviderEntry[]` | resolved at construction | `LLM_CHAT_WEB_SEARCH_PROVIDERS` | Active search backends (see below) |
| `maxResults` | `number` | `5` | `LLM_CHAT_WEB_SEARCH_MAX_RESULTS` | Default result count per search |
| `maxCharsPerResult` | `number` | `2000` | `LLM_CHAT_WEB_SEARCH_MAX_CHARS_PER_RESULT` | Default max chars per result snippet |
| `searchTimeoutMs` | `number` | `4000` | `LLM_CHAT_WEB_SEARCH_TIMEOUT_MS` | Timeout in ms for search API requests |
| `concurrency` | `number` | `3` | `LLM_CHAT_WEB_SEARCH_CONCURRENCY` | Concurrency limit for parallel searches |

### Multi-provider mode

Each entry of the `providers` array is a `ProviderEntry`:

```typescript
type ProviderEntry = {
    provider: WebSearchProvider;
    apiKey?: string;   // Per-provider API key
    weight?: number;   // Selection weight used by weighted_random (default: 1)
};
```

Entries are resolved in this order (first match wins):

1. Constructor argument (`providers` array), when non-empty.
2. `LLM_CHAT_WEB_SEARCH_PROVIDERS` env var — comma-separated provider names (e.g. `duckduckgo,tavily`). Unknown names are skipped. Each entry's API key comes from its dedicated per-provider env var.
3. A single keyless `duckduckgo` entry, so zero-config setups keep working.

The list is never empty after construction. The `strategy` property selects how the entries are combined:

| Strategy | Env value | Behavior |
|---|---|---|
| `ProviderStrategy.Single` | `single` | Query the first provider only |
| `ProviderStrategy.Parallel` | `parallel` | Query all providers concurrently and merge results |
| `ProviderStrategy.Fallback` | `fallback` | Try providers in order until one succeeds |
| `ProviderStrategy.WeightedRandom` | `weighted_random` | Pick one provider per query via weight distribution |
| `ProviderStrategy.RoundRobin` | `round_robin` | Cycle through the providers across consecutive queries |

Invalid strategy values fall back to `single`. Behavioral details are described in [architecture](architecture.md#composite-provider-and-strategies).

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
