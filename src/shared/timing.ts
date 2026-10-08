export interface ResolveElapsedParams {
  /** Elapsed time as reported by the client, in ms. May be null/undefined/absent. */
  clientElapsedMs: number | null | undefined;
  /** Server-observed elapsed time: answeredAt - servedAt, in ms. */
  serverElapsedMs: number;
  /** Question time limit, in ms. */
  limitMs: number;
  /** How far below the server's value the client value may be and still be trusted. */
  toleranceMs: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

/**
 * Reconciles client-reported timing against the server's own record to
 * resist clock manipulation while tolerating flaky convention wifi.
 *
 * The client's value is trusted only when it is:
 *   - not greater than the server's observed elapsed time (a larger client
 *     value would mean the client claims to have taken *longer* than the
 *     server saw, which is only possible by tampering), and
 *   - not more than `toleranceMs` below the server's observed elapsed time
 *     (a much smaller client value would mean claiming to have answered
 *     suspiciously faster than the server saw).
 *
 * Otherwise, the server's own measurement is used. The result is always
 * clamped to [0, limitMs].
 */
export function resolveElapsedMs(params: ResolveElapsedParams): number {
  const { clientElapsedMs, serverElapsedMs, limitMs, toleranceMs } = params;
  const serverClamped = clamp(serverElapsedMs, 0, limitMs);

  if (
    clientElapsedMs == null ||
    !Number.isFinite(clientElapsedMs) ||
    clientElapsedMs < 0 ||
    clientElapsedMs > limitMs
  ) {
    return serverClamped;
  }

  if (clientElapsedMs > serverElapsedMs) {
    return serverClamped;
  }

  if (clientElapsedMs < serverElapsedMs - toleranceMs) {
    return serverClamped;
  }

  return clamp(clientElapsedMs, 0, limitMs);
}
