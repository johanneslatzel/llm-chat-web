# LLM Chat Web

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM](https://nodei.co/npm/@johannes.latzel/llm-chat-web.svg?style=shields&data=n,v,u,d,s)](https://www.npmjs.com/package/@johannes.latzel/llm-chat-web)
[![version](https://img.shields.io/github/package-json/v/johanneslatzel/llm-chat-web)](https://github.com/johanneslatzel/llm-chat-web/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-web/pulls)
[![codecov](https://codecov.io/gh/johanneslatzel/llm-chat-web/graph/badge.svg)](https://codecov.io/gh/johanneslatzel/llm-chat-web)
[![Feedback Welcome](https://img.shields.io/badge/feedback-welcome-brightgreen)](https://github.com/johanneslatzel/llm-chat-web/discussions)
[![CI](https://github.com/johanneslatzel/llm-chat-web/actions/workflows/ci.yml/badge.svg)](https://github.com/johanneslatzel/llm-chat-web/actions/workflows/ci.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-web/latest)](https://badge.socket.dev/npm/package/@johannes.latzel/llm-chat-web/latest)
[![AI Assisted Yes](https://img.shields.io/badge/AI%20Assisted-Yes-green)](https://github.com/mefengl/made-by-ai)

Web tool suite for the `llm-chat` ecosystem — equips LLM agents with web search and URL fetching capabilities, with intelligent content extraction.

## Features

- `web_search` tool: three search providers: DuckDuckGo (free, no API key), Tavily, and ExaAI
- `web_fetch` tool: intelligent URL fetching with Mozilla Readability extraction, CSS-selector fallback, and built-in content-type handlers for HTML, JSON, XML, CSV, Markdown, and plain text
- parallel execution of queries and fetches with configurable concurrency
- Content-Length pre-check on URL fetches to reject oversized responses before downloading
- configurable via config objects and env vars

## Prerequisites

- Node.js >= 18

## Installation

```bash
npm install @johannes.latzel/llm-chat-web
```

## Documentation

Full documentation at **[johanneslatzel.github.io/llm-chat-web/](https://johanneslatzel.github.io/llm-chat-web/)**

## License

MIT — see [`LICENSE`](LICENSE).

## Contributing

Issues and PRs welcome at [github.com/johanneslatzel/llm-chat-web](https://github.com/johanneslatzel/llm-chat-web).
