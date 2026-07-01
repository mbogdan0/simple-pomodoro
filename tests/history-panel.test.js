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
        focusNote: 'Prepare math chapter summary',
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
    expect(html).toContain('data-action="import-focus-history"');
    expect(html).toContain('data-action="export-focus-history"');
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
    expect(html).toContain('Prepare math chapter summary');
    expect(html).toContain('history-tag--none');
    expect(html).toContain('history-tag--study');
    expect(html).toContain('history-tag--work');
    expect(html).toContain('Other');
    expect((html.match(/class="history-day-group"/g) ?? []).length).toBe(2);
    expect((html.match(/data-action="clear-history-entry"/g) ?? []).length).toBe(3);
    expect((html.match(/class="history-edit-menu"/g) ?? []).length).toBe(3);
    expect((html.match(/class="ghost-button history-edit-menu__trigger"/g) ?? []).length).toBe(3);
    expect((html.match(/data-action="toggle-history-entry-note-edit"/g) ?? []).length).toBe(3);
    expect((html.match(/data-action="toggle-history-entry-tag-edit"/g) ?? []).length).toBe(3);
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
    expect(html).toContain('data-action="import-focus-history"');
    expect(html).toMatch(/data-action="export-focus-history"[^>]*disabled/);
    expect(html).not.toContain('data-focus-note-input');
    expect(html).not.toContain('history-list');
    expect(html).not.toContain('Last backup:');
  });

  it('renders inline history tag choices for selected editing entry', () => {
    const completedAt = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const html = renderHistoryPanel(
      [
        {
          completedAt,
          durationMs: 40 * 60 * 1000,
          focusTag: 'work',
          id: 'focus-1',
          stepId: 'focus-1',
          stepType: 'work'
        }
      ],
      'focus-1'
    );

    expect((html.match(/data-action="set-history-entry-focus-tag"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-focus-tag="none"');
    expect(html).toContain('data-focus-tag="work"');
    expect(html).toContain('data-focus-tag="study"');
    expect(html).not.toContain('data-action="toggle-history-entry-tag-edit"');
    expect(html).not.toContain('data-action="toggle-history-entry-note-edit"');
    expect(html).not.toContain('class="history-edit-menu"');
  });

  it('renders inline history note input for selected editing entry', () => {
    const completedAt = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const html = renderHistoryPanel(
      [
        {
          completedAt,
          durationMs: 25 * 60 * 1000,
          focusNote: 'Read chapter 4',
          focusTag: 'study',
          id: 'focus-1',
          stepId: 'focus-1',
          stepType: 'work'
        }
      ],
      '',
      'focus-1'
    );

    expect(html).toContain('data-history-entry-focus-note-input');
    expect(html).toContain('data-entry-id="focus-1"');
    expect(html).toContain('value="Read chapter 4"');
    expect(html).toContain('Done');
    expect(html).not.toContain('class="history-edit-menu"');
  });

  it('escapes focus note content in history item text and title', () => {
    const completedAt = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const html = renderHistoryPanel([
      {
        completedAt,
        durationMs: 25 * 60 * 1000,
        focusNote: "'><img src=x onerror=alert(1)>",
        focusTag: 'work',
        id: 'focus-1',
        stepId: 'focus-1',
        stepType: 'work'
      }
    ]);

    expect(html).toContain('history-item-note');
    expect(html).toContain('&#39;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('escapes focus note content in history note input values', () => {
    const completedAt = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const html = renderHistoryPanel(
      [
        {
          completedAt,
          durationMs: 25 * 60 * 1000,
          focusNote: '"<script>alert(1)</script>',
          focusTag: 'work',
          id: 'focus-1',
          stepId: 'focus-1',
          stepType: 'work'
        }
      ],
      '',
      'focus-1'
    );

    expect(html).toContain('&quot;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders backup status and warning only when stale history spans at least 21 days', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date(2026, 6, 1).getTime();
    const history = [
      {
        completedAt: now,
        durationMs: 25 * 60 * 1000,
        focusTag: 'work',
        id: 'focus-new',
        stepId: 'focus-new',
        stepType: 'work'
      },
      {
        completedAt: now - 22 * dayMs,
        durationMs: 25 * 60 * 1000,
        focusTag: 'study',
        id: 'focus-old',
        stepId: 'focus-old',
        stepType: 'work'
      }
    ];
    const staleHtml = renderHistoryPanel(history, '', '', {
      lastFocusHistoryExportedAt: null,
      now
    });
    const freshHtml = renderHistoryPanel(history, '', '', {
      lastFocusHistoryExportedAt: now,
      now
    });

    expect(staleHtml).toContain('Last backup: never');
    expect(staleHtml).toContain('history-backup-status--warning');
    expect(freshHtml).toContain('Last backup: today');
    expect(freshHtml).not.toContain('history-backup-status--warning');
  });

  it('renders import result notices inline', () => {
    const completedAt = new Date(2026, 3, 20, 18, 30, 0).getTime();
    const html = renderHistoryPanel(
      [
        {
          completedAt,
          durationMs: 25 * 60 * 1000,
          focusTag: 'work',
          id: 'focus-1',
          stepId: 'focus-1',
          stepType: 'work'
        }
      ],
      '',
      '',
      {
        importNotice: 'Imported 1 entries. Skipped 2 duplicates.'
      }
    );

    expect(html).toContain('history-import-notice');
    expect(html).toContain('Imported 1 entries. Skipped 2 duplicates.');
  });
});
