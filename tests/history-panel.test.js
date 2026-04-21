import { describe, expect, it } from 'vitest';

import { renderHistoryPanel } from '../src/ui/history-panel.js';

describe('history panel behavior', () => {
  it('renders day-grouped entries with daily totals and clear actions', () => {
    const recentDayLate = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const recentDayEarly = new Date(2026, 3, 20, 9, 15, 0).getTime();
    const previousDay = new Date(2026, 3, 19, 12, 0, 0).getTime();
    const html = renderHistoryPanel([
      {
        completedAt: recentDayLate,
        durationMs: 40 * 60 * 1000,
        focusTag: 'unknown-tag',
        id: 'focus-1',
        stepId: 'focus-1',
        stepType: 'work'
      },
      {
        completedAt: recentDayEarly,
        durationMs: 25 * 60 * 1000,
        focusTag: 'study',
        id: 'focus-2',
        stepId: 'focus-2',
        stepType: 'work'
      },
      {
        completedAt: previousDay,
        durationMs: 45 * 60 * 1000,
        focusTag: 'work',
        id: 'focus-3',
        stepId: 'focus-3',
        stepType: 'work'
      }
    ]);

    expect(html).toContain('Focus History');
    expect(html).toContain('history-list');
    expect(html).toContain('history-day-group');
    expect(html).toContain('history-day-list');
    expect(html).toContain('history-day-title');
    expect(html).toContain('history-day-total');
    expect(html).toContain('1h 5m focus');
    expect(html).toContain('45m focus');
    expect(html).toContain('40:00');
    expect(html).toContain('25:00');
    expect(html).toContain('45:00');
    expect(html).toContain('history-tag--none');
    expect(html).toContain('history-tag--study');
    expect(html).toContain('history-tag--work');
    expect((html.match(/class="history-day-group"/g) ?? []).length).toBe(2);
    expect((html.match(/data-action="clear-history-entry"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-entry-id="focus-1"');
    expect(html).toContain('data-entry-id="focus-2"');
    expect(html).toContain('data-entry-id="focus-3"');
    expect(html).toContain(`datetime="${new Date(recentDayLate).toISOString()}"`);
    expect(html).toContain(`datetime="${new Date(recentDayEarly).toISOString()}"`);
    expect(html).toContain(`datetime="${new Date(previousDay).toISOString()}"`);
  });

  it('renders empty state when no entries are present', () => {
    const html = renderHistoryPanel([]);

    expect(html).toContain('No completed focus sessions yet.');
    expect(html).not.toContain('history-list');
  });
});
