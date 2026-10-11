import type { ContentHandler } from './content-handler.js';
import { CsvHandler } from './content-handlers/csv-handler.js';
import { GenericTextHandler } from './content-handlers/generic-text-handler.js';
import { HtmlHandler } from './content-handlers/html-handler.js';
import { JsonHandler } from './content-handlers/json-handler.js';
import { MarkdownHandler } from './content-handlers/markdown-handler.js';
import { PdfHandler } from './content-handlers/pdf-handler.js';
import { PlainTextHandler } from './content-handlers/plain-text-handler.js';
import { XmlHandler } from './content-handlers/xml-handler.js';

/** Options used when registering the built-in handler set. */
export interface FetchRegistryOptions {
    /** Default page cap passed to the built-in {@link PdfHandler}. */
    maxPdfPages?: number;
}

/**
 * A registry that maps HTTP `Content-Type` values to their matching
 * {@link ContentHandler} implementations.
 *
 * Handlers are checked in registration order — the first handler whose
 * `match()` returns `true` wins.
 *
 * Call {@link init} once before use to automatically populate default
 * handlers if none have been registered yet.
 */
export class FetchRegistry {
    private readonly handlers: ContentHandler[] = [];
    private isInitialized = false;

    /**
     * Register a content-type handler.
     *
     * @param handler The handler to add. Its `match()` method will be called
     *                for every incoming response.
     */
    register(handler: ContentHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Find the first registered handler that matches the given content type.
     *
     * @param contentType The `Content-Type` header value (e.g.
     *                    `"application/json; charset=utf-8"`).
     * @returns The matching handler, or `undefined` if none matches.
     */
    getHandler(contentType: string): ContentHandler | undefined {
        return this.handlers.find((h) => h.match(contentType));
    }

    /**
     * Register all built-in content-type handlers in priority order.
     *
     * This is called automatically by {@link init} when no handlers have been
     * registered yet. The registration order (most specific first) is:
     * html → json → xml → pdf → csv → markdown → plain-text → generic-text.
     *
     * @param options Options forwarded to the built-in handlers (e.g. the PDF page cap).
     */
    registerDefaults(options?: FetchRegistryOptions): void {
        this.register(new HtmlHandler());
        this.register(new JsonHandler());
        this.register(new XmlHandler());
        this.register(new PdfHandler({ maxPages: options?.maxPdfPages }));
        this.register(new CsvHandler());
        this.register(new MarkdownHandler());
        this.register(new PlainTextHandler());
        this.register(new GenericTextHandler());
    }

    /**
     * Lazy-initialize the registry with default handlers if no handlers are present.
     *
     * Safe to call multiple times — only the first invocation has any effect.
     * If no handlers have been {@link register}ed yet, {@link registerDefaults}
     * is called to populate the built-in set.
     *
     * @param options Options forwarded to {@link registerDefaults}.
     */
    init(options?: FetchRegistryOptions): void {
        if (this.isInitialized) return;
        this.isInitialized = true;
        if (this.handlers.length === 0) {
            this.registerDefaults(options);
        }
    }
}
