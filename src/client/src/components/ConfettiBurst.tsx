import { useMemo } from "react";

const COLORS = ["var(--brand-secondary)", "var(--brand-accent)", "var(--brand-primary)", "#ffffff"];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A one-shot, CSS-only confetti fall, used to celebrate finishing a round. */
export default function ConfettiBurst({ count = 28 }: { count?: number }): JSX.Element | null {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.8 + Math.random() * 1.1,
        rotate: Math.round(Math.random() * 360),
        color: COLORS[i % COLORS.length],
        width: 6 + Math.round(Math.random() * 6),
      })),
    [count]
  );

  if (prefersReducedMotion()) return null;

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: p.color,
            width: p.width,
            height: Math.round(p.width * 0.4),
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
