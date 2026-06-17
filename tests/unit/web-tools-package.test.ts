import { describe, expect, it } from 'vitest';
import { WebToolsPackage } from '../../src/tools/web-tools-package.js';

describe('WebToolsPackage', () => {
    it('returns both web tools', () => {
        const pkg = new WebToolsPackage();
        expect(pkg.tools()).toHaveLength(2);
        expect(pkg.tools()[0]!.constructor.name).toBe('WebSearchTool');
        expect(pkg.tools()[1]!.constructor.name).toBe('WebFetchTool');
    });
});
