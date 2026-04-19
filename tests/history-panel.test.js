import { describe, expect, it } from 'vitest';

import { renderHistoryPanel } from '../src/ui/history-panel.js';

describe('history panel', () => {
  it('renders completed focus entries with date/time, duration and clear action', () => {
    const completedAt = 1_713_000_000_000;
    const localDateTime = new Date(completedAt).toLocaleString();
    const html = renderHistoryPanel([
      {
        completedAt,
        durationMs: 25 * 60 * 1000,
        focusTag: 'work',
        id: 'focus-1:1713000000000',
        stepId: 'focus-1',
        stepType: 'work'
      }
    ]);

    expect(html).toContain('Focus History');
    expect(html).toContain('history-list');
    expect(html).toContain('25 min');
    expect(html).toContain('Work');
    expect(html).toContain('history-tag--work');
    expect(html).toContain(localDateTime);
    expect(html).toContain(`datetime="${new Date(completedAt).toISOString()}"`);
    expect(html).toContain('data-action="clear-history-entry"');
    expect(html).toContain('data-entry-id="focus-1:1713000000000"');
  });

  it('renders an empty state when no history entries are available', () => {
    const html = renderHistoryPanel([]);

    expect(html).toContain('No completed focus sessions yet.');
    expect(html).not.toContain('history-list');
  });
});
