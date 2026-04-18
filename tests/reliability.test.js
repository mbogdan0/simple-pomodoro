import { describe, expect, it } from 'vitest';

import {
  createCompletionKey,
  createFocusMinuteReminderKey,
  resolveCompletionNotificationBody,
  selectNotificationChannel,
  shouldDispatchCompletion,
  shouldDispatchFocusMinuteReminder
} from '../src/core/alerts.js';
import { getCycleRepeatDots, getFocusRepeatProgress, getStepProgress } from '../src/core/progress.js';
import { createDefaultSettings } from '../src/core/settings.js';
import { createInitialSession, startCurrentStep, syncSession } from '../src/core/session.js';

function pickChannelFromMockedApis(mockedEnvironment) {
  const mockedNotificationApi = mockedEnvironment.Notification;

  return selectNotificationChannel({
    hasNotificationApi: typeof mockedNotificationApi === 'function',
    hasServiceWorker: Boolean(mockedEnvironment.navigator?.serviceWorker),
    notificationPermission:
      typeof mockedNotificationApi === 'function'
        ? mockedNotificationApi.permission
        : 'unsupported'
  });
}

describe('reliability helpers', () => {
  it('maps focus-repeat and step progress across work and break steps', () => {
    const settings = createDefaultSettings();
    settings.repeatCount = 2;
    const session = createInitialSession(settings);

    const firstWork = {
      ...session,
      currentStepIndex: 0
    };
    const shortBreak = {
      ...session,
      currentStepIndex: 1
    };
    const secondWork = {
      ...session,
      currentStepIndex: 2
    };
    const longBreak = {
      ...session,
      currentStepIndex: 3
    };

    expect(getFocusRepeatProgress(firstWork)).toEqual({
      focusRepeatCurrent: 1,
      focusRepeatTotal: 2
    });
    expect(getFocusRepeatProgress(shortBreak)).toEqual({
      focusRepeatCurrent: 1,
      focusRepeatTotal: 2
    });
    expect(getFocusRepeatProgress(secondWork)).toEqual({
      focusRepeatCurrent: 2,
      focusRepeatTotal: 2
    });
    expect(getFocusRepeatProgress(longBreak)).toEqual({
      focusRepeatCurrent: 2,
      focusRepeatTotal: 2
    });
    expect(getStepProgress(longBreak)).toEqual({
      stepCurrent: 4,
      stepTotal: 4
    });
  });

  it('builds double-ring repeat states for focus and break progress', () => {
    const settings = createDefaultSettings();
    settings.repeatCount = 2;
    const session = createInitialSession(settings);

    const atFirstFocus = getCycleRepeatDots({
      ...session,
      currentStepIndex: 0,
      status: 'idle'
    });
    const atShortBreak = getCycleRepeatDots({
      ...session,
      currentStepIndex: 1,
      status: 'idle'
    });
    const atLongBreak = getCycleRepeatDots({
      ...session,
      currentStepIndex: 3,
      status: 'idle'
    });

    expect(atFirstFocus).toEqual([
      { breakState: 'pending', focusState: 'active', id: session.scenario[0].id },
      { breakState: 'pending', focusState: 'pending', id: session.scenario[2].id }
    ]);
    expect(atShortBreak).toEqual([
      { breakState: 'active', focusState: 'done', id: session.scenario[0].id },
      { breakState: 'pending', focusState: 'pending', id: session.scenario[2].id }
    ]);
    expect(atLongBreak).toEqual([
      { breakState: 'done', focusState: 'done', id: session.scenario[0].id },
      { breakState: 'active', focusState: 'done', id: session.scenario[2].id }
    ]);
  });

  it('deduplicates completion alerts by completion key', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_500);
    const completionKey = createCompletionKey(completed);

    expect(completionKey).toBeTruthy();
    expect(shouldDispatchCompletion(completionKey, '')).toBe(true);
    expect(shouldDispatchCompletion(completionKey, completionKey)).toBe(false);
  });

  it('resolves completion notification body for auto-start and cycle-end states', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_500);

    expect(
      resolveCompletionNotificationBody({
        autoStartNextStep: false,
        session: completed
      })
    ).toBe('The next step is ready. Press Start to continue.');

    expect(
      resolveCompletionNotificationBody({
        autoStartNextStep: true,
        session: completed
      })
    ).toBe('The next step started automatically.');

    const base = createInitialSession(settings);
    const runningLastStep = startCurrentStep(
      {
        ...base,
        currentStepIndex: base.scenario.length - 1
      },
      2_000
    );
    const completedLastStep = syncSession(runningLastStep, runningLastStep.endsAt + 1_500);

    expect(
      resolveCompletionNotificationBody({
        autoStartNextStep: true,
        session: completedLastStep
      })
    ).toBe('Cycle complete. Press Start to begin a new cycle.');
  });

  it('selects notification fallback channel using mocked browser APIs', () => {
    expect(
      pickChannelFromMockedApis({
        Notification: Object.assign(function Notification() {}, {
          permission: 'granted'
        }),
        navigator: {
          serviceWorker: {}
        }
      })
    ).toBe('window');

    expect(
      pickChannelFromMockedApis({
        Notification: Object.assign(function Notification() {}, {
          permission: 'default'
        }),
        navigator: {
          serviceWorker: {}
        }
      })
    ).toBe('service-worker');

    expect(
      pickChannelFromMockedApis({
        navigator: {}
      })
    ).toBe('none');
  });

  it('dispatches one-minute focus reminders once per step run', () => {
    const settings = createDefaultSettings();
    const runningFocus = startCurrentStep(createInitialSession(settings), 1_000);
    const minuteMark = runningFocus.endsAt - 60_000;
    const reminderKey = createFocusMinuteReminderKey(runningFocus);

    expect(reminderKey).toBeTruthy();

    const firstAttempt = shouldDispatchFocusMinuteReminder({
      notificationsEnabled: true,
      now: minuteMark,
      previousKey: '',
      session: runningFocus
    });
    const duplicateAttempt = shouldDispatchFocusMinuteReminder({
      notificationsEnabled: true,
      now: minuteMark + 2_000,
      previousKey: firstAttempt.key,
      session: runningFocus
    });
    const disabledNotificationsAttempt = shouldDispatchFocusMinuteReminder({
      notificationsEnabled: false,
      now: minuteMark,
      previousKey: '',
      session: runningFocus
    });
    const runningBreak = startCurrentStep(
      {
        ...createInitialSession(settings),
        currentStepIndex: 1
      },
      2_000
    );
    const breakAttempt = shouldDispatchFocusMinuteReminder({
      notificationsEnabled: true,
      now: runningBreak.endsAt - 30_000,
      previousKey: '',
      session: runningBreak
    });

    expect(firstAttempt).toEqual({
      key: reminderKey,
      shouldDispatch: true
    });
    expect(duplicateAttempt.shouldDispatch).toBe(false);
    expect(disabledNotificationsAttempt.shouldDispatch).toBe(false);
    expect(breakAttempt.shouldDispatch).toBe(false);
  });
});
