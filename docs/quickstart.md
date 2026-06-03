# Quickstart

```bash
npm install @johannes.latzel/llm-chat-web
```

## Web search

Search the web with DuckDuckGo — no API key required. Just use the default constructor:

```typescript
import { WebSearchTool, WebSearchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebSearchTool(new WebSearchConfiguration());

const result = await tool.execute({ query: '@johannes.latzel/llm-chat-web latest version' });
console.log(result.result);
```

That's it.

## URL fetching

Fetch a URL and get its clean text content:

```typescript
import { WebFetchTool, WebFetchConfiguration } from '@johannes.latzel/llm-chat-web';

const tool = new WebFetchTool(new WebFetchConfiguration());

const result = await tool.execute({ url: 'https://johanneslatzel.github.io/llm-chat-web/' });
console.log(result.result);
```
