# API Reference

Every symbol re-exported by the package entry point. Defaults and environment
variables live on the [Environment Variables](configuration.md) page; runnable
examples live on the [Usage](usage.md) page.

## Tools

Both tools extend `Tool` from `@johannes.latzel/llm-chat-tool` and inherit
`execute(args)`, `normalizeArguments(args)`, and `definition()`. The
`onExecute` hook is protected. Execution never throws: failures are returned as
results with `ResultStatus.Error`.

### WebSearchTool

Tool name: `web_search`. Runs one or more queries and returns titles, URLs, and
snippets, with one result per query.

#### Constructor

```typescript
new WebSearchTool(config: WebSearchConfiguration)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `config` | `WebSearchConfiguration` | yes | Providers, strategy, limits, and timeouts |

#### Tool parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `queries` | `string[]` | yes | Non-empty array of search queries. Hidden alias: `query` |
| `max_results` | `number` | no | Results per query, clamped to 1-20. Defaults to `config.maxResults` |
| `max_chars_per_result` | `number` | no | Characters per result, clamped to 1-50000. Defaults to `config.maxCharsPerResult` |

#### Execution

- The provider is resolved from the configuration on every call.
- Queries run concurrently with `config.concurrency`; concurrency is capped at
  1 when every provider entry is `DuckDuckGo`.
- A provider resolution failure returns an error result for the call.
- A query that is not a non-empty string yields an error result for that query
  while the remaining queries still run.

### WebFetchTool

Tool name: `web_fetch`. Fetches one or more URLs and returns extracted content,
with one result per URL.

#### Constructor

```typescript
new WebFetchTool(
    config: WebFetchConfiguration,
    registry?: ContentHandlerRegistry
)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `config` | `WebFetchConfiguration` | yes | Timeout, size limits, concurrency, and header rules |
| `registry` | `ContentHandlerRegistry` | no | Custom handler registry. Defaults to a new registry populated with the built-in handlers |

The constructor calls `registry.init({ maxPdfPages: config.maxPdfPages })`.

#### Tool parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `urls` | `string[]` | yes | Non-empty array of URLs. Hidden alias: `url` |
| `max_chars` | `number` | no | Characters per URL, clamped to 1 through `config.maxCharsPerFetchLimit`. Defaults to `config.maxCharsPerFetch` |
| `max_pages` | `number` | no | PDF page cap. Must be a positive integer no greater than `config.maxPdfPages`; defaults to `config.maxPdfPages` |

#### Execution

For each URL the tool resolves header rules, checks the declared content length
with a `HEAD` request, rejects bodies above `config.maxContentLengthBytes`,
fetches with `config.fetchTimeoutMs`, and dispatches on the response
`Content-Type` to the registry.

- URLs run concurrently with `config.concurrency`.
- A `max_pages` value that is not a positive integer or that exceeds
  `config.maxPdfPages` fails the call.
- An unsupported content type yields an error result for that URL.

### WebToolsPackage

Bundles both tools into a single `ToolPackage`.

#### Constructor

```typescript
new WebToolsPackage(
    searchConfig?: WebSearchConfiguration,
    fetchConfig?: WebFetchConfiguration,
    fetchRegistry?: ContentHandlerRegistry
)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `searchConfig` | `WebSearchConfiguration` | no | Search configuration. Defaults to `new WebSearchConfiguration()` |
| `fetchConfig` | `WebFetchConfiguration` | no | Fetch configuration. Defaults to `new WebFetchConfiguration()` |
| `fetchRegistry` | `ContentHandlerRegistry` | no | Registry passed to the fetch tool |

#### Methods

| Method | Returns | Description |
|---|---|---|
| `tools()` | `Tool[]` | The `web_search` and `web_fetch` instances |
| `tutorial()` | `string \| null` | Inherited from `ToolPackage`; returns `null` |

## Configurations

Defaults and environment variable names are listed on the
[Environment Variables](configuration.md) page. The tables below describe the
public fields.

### WebSearchConfiguration

#### Constructor

```typescript
new WebSearchConfiguration(
    providers?: ProviderEntry[],
    strategy?: ProviderStrategy
)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `providers` | `ProviderEntry[]` | no | Provider entries to combine |
| `strategy` | `ProviderStrategy` | no | Overrides the strategy from the environment |

Provider resolution works as follows:

- A non-empty `providers` argument is copied as given.
- An omitted or empty argument resolves entries from
  `LLM_CHAT_WEB_SEARCH_PROVIDERS`; unknown names are skipped.
- When no valid name remains, a single keyless `DuckDuckGo` entry is used.

#### Properties

| Property | Type | Description |
|---|---|---|
| `maxResults` | `number` | Default results per query |
| `maxCharsPerResult` | `number` | Default characters per result snippet |
| `searchTimeoutMs` | `number` | Timeout for one search-API call, in milliseconds |
| `concurrency` | `number` | Maximum concurrent queries |
| `strategy` | `ProviderStrategy` | Strategy used to combine provider entries |
| `providers` | `ProviderEntry[]` | Active backends; non-empty after construction |

All state is held in public properties; the class has no public methods.

### WebFetchConfiguration

#### Constructor

```typescript
new WebFetchConfiguration()
```

Every field except `headerRules` is initialized from its environment
variable.

#### Properties

| Property | Type | Description |
|---|---|---|
| `maxCharsPerFetch` | `number` | Default characters per URL |
| `maxCharsPerFetchLimit` | `number` | Upper bound for a per-call `max_chars` |
| `fetchTimeoutMs` | `number` | Timeout per fetch, in milliseconds |
| `maxContentLengthBytes` | `number` | Declared body size above which the fetch is rejected |
| `concurrency` | `number` | Maximum concurrent fetches |
| `maxPdfPages` | `number` | Default and maximum PDF page cap |
| `headerRules` | `HeaderRule[]` | Host-controlled header rules; config only, no environment variable |

The class has no public methods.

## Enums

### WebSearchProvider

| Member | Value |
|---|---|
| `DuckDuckGo` | `duckduckgo` |
| `Tavily` | `tavily` |
| `ExaAI` | `exaai` |
| `Firecrawl` | `firecrawl` |

### ProviderStrategy

| Member | Value | Behavior |
|---|---|---|
| `Single` | `single` | Query the first provider only |
| `Parallel` | `parallel` | Query all providers concurrently and merge results |
| `Fallback` | `fallback` | Try providers in order until one succeeds |
| `WeightedRandom` | `weighted_random` | Select one provider per query by weight |
| `RoundRobin` | `round_robin` | Cycle through providers across consecutive queries |

The [architecture](architecture.md#composite-provider-and-strategies) page
describes merging and failure behavior per strategy.

## Types

### ProviderEntry

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | `WebSearchProvider` | yes | Backend to use |
| `apiKey` | `string` | no | Per-entry API key |
| `weight` | `number` | no | Selection weight for weighted strategies; consumers default it to 1 |

### WebSearchResult

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes | Result title |
| `url` | `string` | yes | URL of the source page |
| `content` | `string` | yes | Snippet or excerpt |
| `score` | `number` | no | Relevance score from the provider |

### WebFetchResult

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes | Page title |
| `url` | `string` | yes | Final URL after redirects |
| `content` | `string` | yes | Extracted plain text |
| `contentType` | `string` | yes | MIME type of the fetched resource |

### HeaderRule

| Field | Type | Required | Description |
|---|---|---|---|
| `pattern` | `string` | yes | Glob pattern matched against the full request URL |
| `headers` | `Record<string, string>` | yes | Headers applied when the pattern matches |

Matching rules merge from least to most specific, so a more specific rule
overrides a less specific one per header name [1].

### HandleOptions

| Field | Type | Required | Description |
|---|---|---|---|
| `maxChars` | `number` | yes | Character budget for the returned content |
| `maxPages` | `number` | no | Page cap for paginated formats; other built-in handlers ignore it |
| `charset` | `string` | no | Charset from the response `Content-Type`; defaults to UTF-8 |

## Content handlers

### ContentHandler

Interface implemented by every content-type handler.

| Member | Type | Description |
|---|---|---|
| `name` | `string` | Read-only handler name, such as `html` |

#### Methods

```typescript
match(contentType: string): boolean
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `contentType` | `string` | yes | `Content-Type` header value from the response |

```typescript
handle(
    body: Uint8Array,
    url: string,
    responseUrl: string,
    options: HandleOptions
): Promise<PartialToolResult> | PartialToolResult
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `body` | `Uint8Array` | yes | Raw response body |
| `url` | `string` | yes | Original request URL |
| `responseUrl` | `string` | yes | Final URL after redirects |
| `options` | `HandleOptions` | yes | Character budget and optional page cap |

### ContentHandlerRegistry

The class is defined as `FetchRegistry` and exported under the alias
`ContentHandlerRegistry`, which is the only public name [2]. Handlers are
checked in registration order; the first handler whose `match()` returns
`true` wins.

#### Methods

```typescript
register(handler: ContentHandler): void
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `handler` | `ContentHandler` | yes | Handler added to the end of the registry |

```typescript
getHandler(contentType: string): ContentHandler | undefined
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `contentType` | `string` | yes | `Content-Type` header value to match |

```typescript
registerDefaults(options?: { maxPdfPages?: number }): void
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `options.maxPdfPages` | `number` | no | Page cap forwarded to `PdfHandler` |

```typescript
init(options?: { maxPdfPages?: number }): void
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `options.maxPdfPages` | `number` | no | Page cap forwarded to `registerDefaults` |

`init` is idempotent: only the first call has an effect, and it registers the
defaults only when no handler has been registered yet. The options object type
is not exported.

### Built-in handlers

| Class | `name` | Matches | Output |
|---|---|---|---|
| `HtmlHandler` | `html` | Type starts with `text/html` | Readability extraction with selector fallback, formatted as title, text, and final URL |
| `JsonHandler` | `json` | `application/json` or any type containing `+json` | Pretty-printed with 2-space indentation; an unparsable body returns an error |
| `XmlHandler` | `xml` | Type starts with `application/xml` or `text/xml`, or contains `+xml` | Body decoded and truncated to `maxChars` |
| `CsvHandler` | `csv` | Type starts with `text/csv` | Body decoded and truncated to `maxChars` |
| `MarkdownHandler` | `markdown` | Type starts with `text/markdown` | Body decoded and truncated to `maxChars` |
| `PlainTextHandler` | `plain-text` | Type starts with `text/plain` | Body decoded and truncated to `maxChars` |
| `GenericTextHandler` | `generic-text` | Any `text/*` except `text/html` | Body decoded and truncated to `maxChars` |
| `PdfHandler` | `pdf` | Type starts with `application/pdf` or `application/x-pdf` | Text layer extracted with PDF.js; no OCR |

Except for `PdfHandler`, the built-in handlers take no constructor arguments.
The default registration order is html, json, xml, pdf, csv, markdown,
plain-text, then generic-text [3].

### PdfHandler

#### Constructor

```typescript
new PdfHandler(options?: { maxPages?: number })
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `options.maxPages` | `number` | no | Default page cap. Defaults to 100; must be a positive integer or the constructor throws |

#### Behavior

- A per-call `options.maxPages` overrides the constructor value.
- A PDF without a text layer returns an explanatory success message.
- An encrypted or malformed PDF returns an error result.
- Page and character truncation notes are appended to the extracted text.

## References

1. `src/lib/header-rules.ts` `resolveHeaderRules`: least-to-most-specific
   merging of matching header rules.
2. `src/index.ts` package entry: export list, including the
   `ContentHandlerRegistry` alias.
3. `src/lib/fetch-registry.ts` `FetchRegistry`: lazy initialization and the
   default handler registration order.
