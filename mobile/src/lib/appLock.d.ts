export interface LockState {
  /** The user's Settings choice. */
  enabled: boolean;
  /** Hardware present AND a biometric or passcode enrolled. */
  available: boolean;
  /** When the app last went to the background, or null for a cold start. */
  backgroundedAt: number | null;
  now: number;
}

export const GRACE_MS: number;
export function shouldLock(o?: LockState): boolean;
