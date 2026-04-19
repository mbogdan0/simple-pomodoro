import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const expectedImports = [
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/timer.css',
  './styles/settings.css',
  './styles/history.css',
  './styles/utilities.css',
  './styles/responsive.css'
];

describe('styles entry contracts', () => {
  it('keeps styles.css as import-only entry with required split modules', () => {
    const stylesEntryPath = path.join(process.cwd(), 'src/styles.css');
    const stylesEntry = readFileSync(stylesEntryPath, 'utf8');
    const imports = Array.from(stylesEntry.matchAll(/@import\s+['"]([^'"]+)['"];/g)).map(
      (match) => match[1]
    );

    expect(imports).toEqual(expectedImports);

    for (const importPath of imports) {
      const resolvedPath = path.join(process.cwd(), 'src', importPath.replace('./', ''));
      expect(existsSync(resolvedPath)).toBe(true);
    }
  });
});
