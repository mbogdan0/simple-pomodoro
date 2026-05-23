// @ts-check

/**
 * @typedef {typeof import('./root-contracts.js').ROOT_ACTIONS[keyof typeof import('./root-contracts.js').ROOT_ACTIONS]} RootActionName
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
 *   removeEventListener?: (eventType: string, handler: EventListener | ((event: Event) => void)) => void,
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
 * @property {(state: import('../types.js').AppState) => void} persistFocusNoteDraft
 * @property {(state: import('../types.js').AppState) => void} persistSettings
 * @property {(type: string, payload?: object) => void} postWorkerAction
 * @property {() => void} renderApp
 * @property {() => Promise<void>} toggleManualPipWindow
 */

export {};
