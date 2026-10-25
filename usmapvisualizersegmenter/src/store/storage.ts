import { createJSONStorage } from 'zustand/middleware';

/**
 * localStorage that never throws: storage can be missing (tests, private
 * windows) or full. In those cases state just isn't saved.
 */
export const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch (err) {
      console.warn(`Could not save "${name}" to browser storage`, err);
    }
  },
  removeItem: (name: string) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Nothing to clean up.
    }
  },
}));

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
