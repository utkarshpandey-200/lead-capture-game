import { useEffect, useRef, useState } from "react";

export interface QuestionTimer {
  remainingMs: number;
  limitMs: number;
  /** Elapsed time since the question was first served (server's servedAt), including any time before this page load. */
  getElapsedMs: () => number;
}

/**
 * Drives the countdown bar from the server's authoritative remaining time.
 * Pass a `resetKey` that changes per question (e.g. questionId) — the timer
 * re-bases itself off the new `initialRemainingMs` whenever that key
 * changes, without requiring the consuming component to remount. A
 * refresh mid-question resumes from the server's record instead of
 * resetting to the full limit, because `initialRemainingMs` comes from
 * the server on every fetch.
 */
export function useQuestionTimer(
  limitMs: number,
  initialRemainingMs: number,
  resetKey: string,
  onExpire: () => void
): QuestionTimer {
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);
  const baseElapsedRef = useRef(Math.max(0, limitMs - initialRemainingMs));
  const mountedAtRef = useRef(performance.now());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    baseElapsedRef.current = Math.max(0, limitMs - initialRemainingMs);
    mountedAtRef.current = performance.now();
    expiredRef.current = false;
    setRemainingMs(initialRemainingMs);

    const interval = setInterval(() => {
      const elapsedSinceMount = performance.now() - mountedAtRef.current;
      const remaining = Math.max(0, limitMs - baseElapsedRef.current - elapsedSinceMount);
      setRemainingMs(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return {
    remainingMs,
    limitMs,
    getElapsedMs: () => baseElapsedRef.current + (performance.now() - mountedAtRef.current),
  };
}
