import { describe, expect, it } from 'vitest';

import {
  createCompletionKey,
  selectNotificationChannel,
  shouldDispatchCompletion
} from '../src/core/alerts.js';
import { getFocusRepeatProgress, getStepProgress } from '../src/core/progress.js';
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

  it('deduplicates completion alerts by completion key', () => {
    const settings = createDefaultSettings();
    const running = startCurrentStep(createInitialSession(settings), 1_000);
    const completed = syncSession(running, running.endsAt + 1_500);
    const completionKey = createCompletionKey(completed);

    expect(completionKey).toBeTruthy();
    expect(shouldDispatchCompletion(completionKey, '')).toBe(true);
    expect(shouldDispatchCompletion(completionKey, completionKey)).toBe(false);
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
});
