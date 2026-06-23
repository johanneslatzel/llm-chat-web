# Quickstart

## Prerequisites

- Node.js >= 18

## Installation

```bash
npm install @johannes.latzel/llm-chat-web
```

## Web search

Search the web with DuckDuckGo — no API key required:

```typescript
import { WebSearchTool, WebSearchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebSearchTool(new WebSearchConfiguration());

const result = await tool.execute({ queries: ['@johannes.latzel/llm-chat-web latest version'] });
console.log(result.result);
```

## URL fetching

Fetch a URL and get its clean text content:

```typescript
import { WebFetchTool, WebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebFetchTool(new WebFetchConfiguration());

const result = await tool.execute({ urls: ['https://johanneslatzel.github.io/llm-chat-web/'] });
console.log(result.result);
```

## Next steps

- Browse [usage](usage.md) for tool parameters, return types, and examples
- See [architecture](architecture.md) for design details
