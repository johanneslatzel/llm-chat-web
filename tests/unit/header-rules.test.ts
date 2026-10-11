import { describe, it, expect } from 'vitest';
import { resolveHeaderRules } from '../../src/lib/header-rules.js';
import type { HeaderRule } from '../../src/lib/header-rules.js';

describe('resolveHeaderRules', () => {
    it('returns no headers when nothing matches', () => {
        const rules: HeaderRule[] = [
            { pattern: 'https://api.example.com/**', headers: { A: '1' } }
        ];
        expect(resolveHeaderRules('https://other.example.com/x', rules)).toEqual({});
    });

    it('applies a single matching rule', () => {
        const rules: HeaderRule[] = [
            { pattern: 'https://api.example.com/**', headers: { A: '1' } }
        ];
        expect(resolveHeaderRules('https://api.example.com/x', rules)).toEqual({ A: '1' });
    });

    it('merges matching rules with the more specific overriding', () => {
        const rules: HeaderRule[] = [
            {
                pattern: 'https://api.example.com/**',
                headers: { Accept: 'application/json', 'X-Common': 'general' }
            },
            {
                pattern: 'https://api.example.com/v2/**',
                headers: { Authorization: 'Bearer x', 'X-Common': 'specific' }
            }
        ];
        expect(resolveHeaderRules('https://api.example.com/v2/users', rules)).toEqual({
            Accept: 'application/json',
            Authorization: 'Bearer x',
            'X-Common': 'specific'
        });
    });

    it('lets the first declared rule win on equal specificity', () => {
        const rules: HeaderRule[] = [
            { pattern: 'https://api.example.com/**', headers: { 'X-Which': 'first' } },
            { pattern: 'https://api.example.com/**', headers: { 'X-Which': 'second' } }
        ];
        expect(resolveHeaderRules('https://api.example.com/x', rules)).toEqual({
            'X-Which': 'first'
        });
    });
});
