/**
 * Keybinding Events
 *
 * A simple pub/sub system for keybinding actions.
 * Components can subscribe to specific action events and react accordingly.
 */

type ActionCallback = () => void;

const actionSubscribers: Map<string, Set<ActionCallback>> = new Map();

/**
 * Subscribe to a keybinding action
 * @param actionId The action ID to subscribe to (e.g., 'editor.goToLine')
 * @param callback The callback to invoke when the action is triggered
 * @returns An unsubscribe function
 */
export function subscribeToAction(actionId: string, callback: ActionCallback): () => void {
  if (!actionSubscribers.has(actionId)) {
    actionSubscribers.set(actionId, new Set());
  }
  actionSubscribers.get(actionId)!.add(callback);

  return () => {
    const subscribers = actionSubscribers.get(actionId);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        actionSubscribers.delete(actionId);
      }
    }
  };
}

/**
 * Emit a keybinding action event
 * @param actionId The action ID to emit
 * @returns true if any subscribers handled the action, false otherwise
 */
export function emitAction(actionId: string): boolean {
  const subscribers = actionSubscribers.get(actionId);
  if (!subscribers || subscribers.size === 0) {
    return false;
  }

  for (const callback of subscribers) {
    callback();
  }
  return true;
}

/**
 * Check if an action has any subscribers
 */
export function hasActionSubscribers(actionId: string): boolean {
  const subscribers = actionSubscribers.get(actionId);
  return !!subscribers && subscribers.size > 0;
}

/**
 * Clear all action subscribers (useful for testing)
 */
export function clearAllActionSubscribers(): void {
  actionSubscribers.clear();
}
