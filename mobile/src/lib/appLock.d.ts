export interface LockContext {
  /** The user's Settings choice. */
  enabled: boolean;
  /** Hardware present AND a biometric or passcode enrolled. */
  available: boolean;
}

export interface LockState {
  /** Authentication is required; the lock screen shows. */
  locked: boolean;
  /** Content hidden, nothing asked, because a snapshot may be taken. */
  covered: boolean;
  /** When the app last really left the foreground, or null. */
  backgroundedAt: number | null;
  /** Bumped whenever the app newly needs asking. Re-arms the prompt. */
  prompts: number;
}

export interface LockEvent {
  type: 'start' | 'inactive' | 'background' | 'active' | 'unlocked';
  now: number;
}

export const GRACE_MS: number;
export const INITIAL: LockState;
export function shouldLock(o?: LockContext & { backgroundedAt: number | null; now: number }): boolean;
export function reduce(state: LockState | null, event: LockEvent, ctx: LockContext): LockState;
