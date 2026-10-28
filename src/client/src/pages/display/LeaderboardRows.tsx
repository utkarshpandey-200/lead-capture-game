import { useLayoutEffect, useRef, useState } from "react";
import type { LeaderboardEntry } from "../../../../shared/types";

function entryKey(e: LeaderboardEntry): string {
  return `${e.displayName}|${e.organization ?? ""}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

/** Top-N rows with a FLIP animation on rank changes and a brief highlight for a genuinely new entrant. */
export default function LeaderboardRows({ entries }: { entries: LeaderboardEntry[] }): JSX.Element {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const hasRenderedOnceRef = useRef(false);
  const [justEntered, setJustEntered] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();
    const newlyEntered = new Set<string>();
    const nextRects = new Map<string, DOMRect>();

    for (const entry of entries) {
      const key = entryKey(entry);
      const el = rowRefs.current.get(key);
      if (!el) continue;
      const newRect = el.getBoundingClientRect();
      const prevRect = prevRectsRef.current.get(key);

      if (prevRect && !reduced) {
        const deltaY = prevRect.top - newRect.top;
        if (Math.abs(deltaY) > 0.5) {
          el.animate(
            [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
            { duration: 500, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
        }
      } else if (!prevRect && hasRenderedOnceRef.current) {
        newlyEntered.add(key);
      }

      nextRects.set(key, newRect);
    }

    prevRectsRef.current = nextRects;
    hasRenderedOnceRef.current = true;

    if (newlyEntered.size > 0 && !reduced) {
      setJustEntered(newlyEntered);
      const t = setTimeout(() => setJustEntered(new Set()), 2200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <div className="leaderboard-rows">
      {entries.map((entry) => {
        const key = entryKey(entry);
        const medal = rankMedal(entry.rank);
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) rowRefs.current.set(key, el);
              else rowRefs.current.delete(key);
            }}
            className={`leaderboard-row${medal ? ` row-rank-${entry.rank}` : ""}${justEntered.has(key) ? " row-entered" : ""}`}
          >
            <span className="row-rank">{medal ?? entry.rank}</span>
            <span className="row-name">
              {entry.displayName}
              {entry.organization ? <span className="row-org"> · {entry.organization}</span> : null}
            </span>
            <span className="row-score">{entry.score.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
