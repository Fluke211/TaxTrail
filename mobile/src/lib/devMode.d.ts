export interface TapState {
  count: number;
  lastAt: number;
}

export interface TapResult extends TapState {
  unlocked: boolean;
  message: string | null;
}

export const TAPS_TO_UNLOCK: number;
export const TAP_GAP_MS: number;
export function tap(state: TapState | null, now: number): TapResult;
