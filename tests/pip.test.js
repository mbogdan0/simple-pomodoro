import { describe, expect, it, vi } from 'vitest';

import { createTimerPipController, isPictureInPictureSupported } from '../src/core/pip.js';

function createFakePipWindow() {
  const listeners = new Map();
  const button = {
    _handlers: {},
    addEventListener(type, handler) {
      this._handlers[type] = handler;
    },
    click() {
      this._handlers.click?.();
    },
    reset() {
      this._handlers = {};
    }
  };
  const body = {
    _html: '',
    get innerHTML() {
      return this._html;
    },
    set innerHTML(value) {
      this._html = value;
      button.reset();
    },
    querySelector(selector) {
      if (selector === '[data-pip-action]') {
        return button;
      }

      return null;
    }
  };
  const pipWindow = {
    closed: false,
    document: {
      body,
      title: ''
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
    close() {
      this.closed = true;
      listeners.get('pagehide')?.();
    },
    dispatchPageHide() {
      listeners.get('pagehide')?.();
    },
    button
  };

  return pipWindow;
}

function createHostWindow({ pipWindow, support = true } = {}) {
  if (!support) {
    return {};
  }

  const hostWindow = {
    documentPictureInPicture: {
      window: null,
      requestWindow: vi.fn(async () => {
        hostWindow.documentPictureInPicture.window = pipWindow;
        return pipWindow;
      })
    }
  };

  return hostWindow;
}

describe('picture-in-picture controller', () => {
  it('detects feature support via documentPictureInPicture API', () => {
    expect(isPictureInPictureSupported(createHostWindow({ pipWindow: createFakePipWindow() }))).toBe(true);
    expect(isPictureInPictureSupported(createHostWindow({ support: false }))).toBe(false);
  });

  it('opens only through the request path when supported', async () => {
    const pipWindow = createFakePipWindow();
    const hostWindow = createHostWindow({ pipWindow });
    const controller = createTimerPipController({ hostWindow });

    const opened = await controller.openFromUserGesture();

    expect(opened).toBe(true);
    expect(hostWindow.documentPictureInPicture.requestWindow).toHaveBeenCalledTimes(1);
    expect(controller.isOpen()).toBe(true);
  });

  it('blocks re-open after manual close until the next start reset', async () => {
    const pipWindow = createFakePipWindow();
    const hostWindow = createHostWindow({ pipWindow });
    const controller = createTimerPipController({ hostWindow });

    await controller.openFromUserGesture();
    pipWindow.closed = true;
    pipWindow.dispatchPageHide();

    expect(controller.isDismissedUntilNextStart()).toBe(true);
    expect(await controller.openFromUserGesture()).toBe(false);
    expect(hostWindow.documentPictureInPicture.requestWindow).toHaveBeenCalledTimes(1);

    controller.resetDismissedForNewStart();
    pipWindow.closed = false;
    hostWindow.documentPictureInPicture.window = null;

    expect(await controller.openFromUserGesture()).toBe(true);
    expect(hostWindow.documentPictureInPicture.requestWindow).toHaveBeenCalledTimes(2);
  });

  it('keeps window open on paused updates and closes on explicit close', async () => {
    const pipWindow = createFakePipWindow();
    const hostWindow = createHostWindow({ pipWindow });
    const controller = createTimerPipController({ hostWindow });

    await controller.openFromUserGesture();
    controller.update({
      clock: '04:59',
      progressPercent: 80,
      status: 'paused',
      stepLabel: 'Focus'
    });

    expect(controller.isOpen()).toBe(true);

    controller.close();
    expect(controller.isOpen()).toBe(false);
  });

  it('dispatches pause and resume actions from PiP button', async () => {
    const pipWindow = createFakePipWindow();
    const hostWindow = createHostWindow({ pipWindow });
    const onAction = vi.fn();
    const controller = createTimerPipController({ hostWindow, onAction });

    await controller.openFromUserGesture();
    controller.update({
      clock: '20:00',
      progressPercent: 10,
      status: 'running',
      stepLabel: 'Focus'
    });
    pipWindow.button.click();

    controller.update({
      clock: '19:59',
      progressPercent: 11,
      status: 'paused',
      stepLabel: 'Focus'
    });
    pipWindow.button.click();

    expect(onAction).toHaveBeenNthCalledWith(1, 'PAUSE');
    expect(onAction).toHaveBeenNthCalledWith(2, 'RESUME');
  });
});
