import { useRef } from "react";
import ConfettiBurst from "../../components/ConfettiBurst";

/**
 * A standalone announcement screen shown between the last random question and
 * the fixed bonus question — its own moment, not a badge bolted onto the
 * question card. Stays up until the player taps through (no auto-advance),
 * via onDone (which fetches the bonus question — kept out of this component
 * so the question's server-side clock doesn't start until the player is
 * actually looking at it).
 */
export default function BonusIntro({ onDone }: { onDone: () => void }): JSX.Element {
  const firedRef = useRef(false);

  function fire() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDone();
  }

  return (
    <div className="bonus-intro" role="status" aria-live="polite">
      <ConfettiBurst count={36} />
      <span className="bonus-intro-ring bonus-intro-ring-1" aria-hidden="true" />
      <span className="bonus-intro-ring bonus-intro-ring-2" aria-hidden="true" />
      <span className="bonus-intro-icon" aria-hidden="true">
        🎁
      </span>
      <h2 className="bonus-intro-title">Bonus Question!</h2>
      <p className="bonus-intro-subtitle">Final question — make it count.</p>
      <button type="button" className="btn btn-primary bonus-intro-btn" onClick={fire}>
        Next →
      </button>
    </div>
  );
}
