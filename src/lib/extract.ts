/*
 * HTML-to-text extraction pipeline.
 *
 * Uses Mozilla's Readability for article pages, with a CSS-selector-based
 * fallback for non-article pages and a final fallback to document.body.
 */

import { JSDOM } from 'jsdom';
import { Readability, isProbablyReaderable } from '@mozilla/readability';

/**
 * Result of extracting human-readable content from an HTML document.
 *
 * @property title       Page title from `<title>` or Readability.
 * @property textContent  Plain text (no markup) — the main output consumers use.
 * @property content      Inner HTML of the extracted container (Readability's `content` or fallback `innerHTML`).
 * @property excerpt      Short description or lead paragraph (Readability only; empty in fallback path).
 * @property byline       Author name from `<meta name="author">` or Readability.
 * @property siteName     Site name from `<meta property="og:site_name">` or Readability.
 */
export type ExtractedContent = {
    title: string;
    textContent: string;
    content: string;
    excerpt: string;
    byline: string | null;
    siteName: string | null;
};

// Minimum text content length to consider extraction successful.
// Shorter results are likely boilerplate or extraction failure.
const MIN_CONTENT_LENGTH = 100;

/*
 * CSS selectors probed in order when Readability yields nothing useful.
 * Ordered by semantic relevance: semantic elements first, then common class names.
 */
const FALLBACK_SELECTORS = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.content'
];

/**
 * Extract readable content from an HTML string.
 *
 * Pipeline: JSDOM parse → strip noise elements → Readability gate →
 *           Readability extraction ──or── CSS-selector fallback.
 *
 * @param html  Raw HTML string.
 * @param url   Source URL (used by JSDOM for relative URL resolution).
 */
export function extractText(html: string, url?: string): ExtractedContent {
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Strip elements that bias Readability's scoring or add noise to output.
    document.querySelectorAll('script, style, noscript, iframe').forEach((el) => el.remove());

    // Only try Readability when the page is probably an article.
    if (isProbablyReaderable(document)) {
        const reader = new Readability(document);
        const article = reader.parse();
        // Reject results under 100 chars — likely boilerplate or extraction failure.
        if (
            article &&
            article.textContent &&
            article.textContent.trim().length >= MIN_CONTENT_LENGTH
        ) {
            return {
                title: article.title || '',
                textContent: article.textContent,
                content: article.content || '',
                excerpt: article.excerpt || '',
                byline: article.byline ?? null,
                siteName: article.siteName ?? null
            };
        }
    }

    // Readability didn't produce usable content — fall back to selector probing.
    return extractFallback(document);
}

/**
 * Probe semantic CSS selectors for content, falling back to document.body.
 */
function extractFallback(document: Document): ExtractedContent {
    const title = document.querySelector('title')?.textContent || '';
    let contentEl: Element | null = null;

    // Walk FALLBACK_SELECTORS in order; pick the first with ≥100 chars.
    for (const sel of FALLBACK_SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length >= MIN_CONTENT_LENGTH) {
            contentEl = el;
            break;
        }
    }

    // contentEl → body → empty string (guarantees non-null result).
    const textContent = contentEl?.textContent || document.body?.textContent || '';

    return {
        title: title.trim(),
        textContent: textContent.trim(),
        content: contentEl?.innerHTML || document.body?.innerHTML || '',
        excerpt: '',
        // Read from <meta> tags since Readability wasn't used in this path.
        byline: document.querySelector('meta[name="author"]')?.getAttribute('content') || null,
        siteName:
            document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null
    };
}
