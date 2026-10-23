import { useEffect, useRef, useState } from "react";
import type { PublicLeaderboard } from "../../../shared/types";

interface FetchResult {
  status: 200 | 304 | "error";
  data?: PublicLeaderboard;
  etag?: string;
}

async function fetchLeaderboardTop(
  board: "overall" | "daily",
  date: string | undefined,
  etag: string | undefined
): Promise<FetchResult> {
  try {
    const qs = new URLSearchParams({ board });
    if (date) qs.set("date", date);
    const res = await fetch(`/api/leaderboard/top?${qs.toString()}`, {
      headers: etag ? { "If-None-Match": etag } : {},
    });
    if (res.status === 304) return { status: 304 };
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as PublicLeaderboard;
    return { status: 200, data, etag: res.headers.get("ETag") ?? undefined };
  } catch {
    return { status: "error" };
  }
}

/**
 * Polls one leaderboard board on an interval using ETag conditional
 * requests, so an unchanged board costs almost nothing. On a network
 * error or a 304, the previously known data is kept as-is — the display
 * screen should never blank out just because one poll failed.
 */
export function usePolledLeaderboard(
  board: "overall" | "daily",
  intervalMs: number,
  date?: string
): { data: PublicLeaderboard | null; stale: boolean } {
  const [data, setData] = useState<PublicLeaderboard | null>(null);
  const [stale, setStale] = useState(false);
  const etagRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    etagRef.current = undefined;
    setData(null);

    async function poll() {
      const result = await fetchLeaderboardTop(board, date, etagRef.current);
      if (cancelled) return;
      if (result.status === 200) {
        etagRef.current = result.etag;
        setData(result.data!);
        setStale(false);
      } else if (result.status === "error") {
        setStale(true);
      }
      // 304: data is already current, nothing to do.
    }

    void poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [board, intervalMs, date]);

  return { data, stale };
}

/** Fetches once, on mount: the event days that have at least one ranked play, most recent first. */
export function useAvailableEventDays(): string[] {
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard/days")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: string[] } | null) => {
        if (!cancelled && data) setDays(data.days);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return days;
}
