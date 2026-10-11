import { RuleSet } from '@johannes.latzel/pattern-specific';

/** A host-controlled HTTP header rule matched against a URL by glob pattern. */
export interface HeaderRule {
    /** Glob pattern matched against the full request URL (e.g. `https://api.example.com/**`). */
    pattern: string;
    /** Headers applied when the pattern matches. */
    headers: Record<string, string>;
}

/** Merge two header rules, so a more specific rule overrides per header name. */
function mergeHeaderRules(current: HeaderRule, next: HeaderRule): HeaderRule {
    return {
        pattern: next.pattern,
        headers: { ...current.headers, ...next.headers }
    };
}

/**
 * Resolve the headers to send for `url` from a list of {@link HeaderRule}s.
 *
 * All matching rules are merged from least specific to most specific, so a more
 * specific rule overrides a less specific one for the same header name. Rules
 * with equal specificity keep declaration order, so the first declared wins.
 *
 * @param url   The full request URL to match against the rule patterns.
 * @param rules The configured header rules.
 * @returns The merged headers, or an empty object when no rule matches.
 */
export function resolveHeaderRules(
    url: string,
    rules: readonly HeaderRule[]
): Record<string, string> {
    const set = new RuleSet<HeaderRule>(mergeHeaderRules);
    for (const rule of rules) {
        set.add(rule);
    }
    return set.apply(url)?.headers ?? {};
}
