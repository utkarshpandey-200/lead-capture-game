import { useEffect, useRef } from "react";

/** Calls onIdle after timeoutMs of no pointer/key/touch activity, while enabled. */
export function useIdleTimer(timeoutMs: number, onIdle: () => void, enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((evt) => document.addEventListener(evt, reset));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => document.removeEventListener(evt, reset));
    };
  }, [timeoutMs, enabled]);
}
