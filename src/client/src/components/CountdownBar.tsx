export default function CountdownBar({
  remainingMs,
  limitMs,
}: {
  remainingMs: number;
  limitMs: number;
}): JSX.Element {
  const fraction = limitMs > 0 ? Math.max(0, Math.min(1, remainingMs / limitMs)) : 0;
  const urgent = fraction <= 0.25;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="countdown-track"
      role="progressbar"
      aria-label="Time remaining"
      aria-valuemin={0}
      aria-valuemax={Math.round(limitMs / 1000)}
      aria-valuenow={seconds}
    >
      <div
        className={`countdown-fill${urgent ? " urgent" : ""}`}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
