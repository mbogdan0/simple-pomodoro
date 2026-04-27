// @ts-check

/**
 * @typedef {
 *   | 'pause-step'
 *   | 'request-notification-permission'
 *   | 'reset-session'
 *   | 'end-step-early'
 *   | 'resume-step'
 *   | 'start-step'
 *   | 'set-focus-tag'
 *   | 'toggle-pip-window'
 *   | 'switch-tab'
 *   | 'clear-history-entry'
 *   | 'toggle-history-entry-tag-edit'
 *   | 'set-history-entry-focus-tag'
 *   | 'test-notification'
 *   | 'test-sound'
 *   | 'test-ntfy'
 * } RootActionName
 */

/**
 * @typedef {{
 *   dataset?: Record<string, string | undefined>,
 *   closest?: (selector: string) => unknown
 * }} RootActionElement
 */

/**
 * @typedef {object} RootEventDeps
 * @property {import('../types.js').AppState} state
 * @property {{
 *   addEventListener: (eventType: string, handler: EventListener | ((event: Event) => void)) => void,
 *   querySelectorAll?: (selector: string) => ArrayLike<{ open?: boolean }>
 * }} root
 * @property {{
 *   playCompletionTone: () => boolean,
 *   playUiActionTone: (soundEnabled: boolean) => boolean
 * }} audioService
 * @property {(nextSession: object, options?: object) => void} commitSession
 * @property {{
 *   requestNotificationPermission: () => Promise<string>,
 *   testNotification: () => Promise<string>,
 *   testNtfy: () => Promise<string>
 * }} notificationService
 * @property {(state: import('../types.js').AppState) => void} persistFocusHistory
 * @property {(state: import('../types.js').AppState) => void} persistSettings
 * @property {(type: string, payload?: object) => void} postWorkerAction
 * @property {() => void} renderApp
 * @property {() => Promise<void>} toggleManualPipWindow
 */

export {};
