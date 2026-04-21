import { describe, expect, it } from 'vitest';

import { renderHistoryPanel } from '../src/ui/history-panel.js';

describe('history panel behavior', () => {
  it('renders completed entries with clear action and normalized tag display', () => {
    const completedAt = 1_713_000_000_000;
    const html = renderHistoryPanel([
      {
        completedAt,
        durationMs: 25 * 60 * 1000,
        focusTag: 'unknown-tag',
        id: 'focus-1:1713000000000',
        stepId: 'focus-1',
        stepType: 'work'
      }
    ]);

    expect(html).toContain('Focus History');
    expect(html).toContain('history-list');
    expect(html).toContain('25:00');
    expect(html).toContain('history-tag--none');
    expect(html).toContain('data-action="clear-history-entry"');
    expect(html).toContain('data-entry-id="focus-1:1713000000000"');
    expect(html).toContain(`datetime="${new Date(completedAt).toISOString()}"`);
  });

  it('renders empty state when no entries are present', () => {
    const html = renderHistoryPanel([]);

    expect(html).toContain('No completed focus sessions yet.');
    expect(html).not.toContain('history-list');
  });
});
