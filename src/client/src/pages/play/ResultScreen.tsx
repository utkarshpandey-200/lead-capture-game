import { useClientConfig } from "../../config/ClientConfigContext";
import { useCountUp } from "../../hooks/useCountUp";
import type { AttemptResult, StandingSummary } from "../../../../shared/types";

function StandingCard({ label, standing }: { label: string; standing: StandingSummary }): JSX.Element {
  if (standing.totalPlayers === 0) {
    return (
      <div className="standing-card">
        <div className="board-name">{label}</div>
        <div className="sub-line">You're the first to play — rankings will fill in soon.</div>
      </div>
    );
  }
  return (
    <div className="standing-card">
      <div className="board-name">{label}</div>
      <div className="rank-line">
        #{standing.rank} of {standing.totalPlayers}
      </div>
      <div className="sub-line">
        Top {standing.topPercent}%
        {standing.pointGapToFifth != null && standing.pointGapToFifth > 0
          ? ` · ${standing.pointGapToFifth} points from the top 5`
          : standing.rank <= 5
            ? " · You're in the top 5!"
            : ""}
      </div>
    </div>
  );
}

export default function ResultScreen({
  result,
  onPlayAgain,
}: {
  result: AttemptResult;
  onPlayAgain: (() => void) | null;
}): JSX.Element {
  const cfg = useClientConfig();
  const animatedScore = useCountUp(result.totalScore);

  return (
    <div className="screen">
      {result.isPractice && (
        <div className="screen-body" style={{ marginBottom: "var(--space-3)" }}>
          Practice round — not added to the leaderboard.
        </div>
      )}

      <p className="result-score-label">Your score</p>
      <p className="result-score">{animatedScore.toLocaleString()}</p>
      <p className="result-score-label" style={{ marginBottom: "var(--space-5)" }}>
        out of {cfg.quiz.questionsPerAttempt * cfg.quiz.maxScorePerQuestion}
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">
            {result.numCorrect}/{cfg.quiz.questionsPerAttempt}
          </div>
          <div className="label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="value">{(result.avgAnswerMs / 1000).toFixed(1)}s</div>
          <div className="label">Avg. answer time</div>
        </div>
      </div>

      {!result.isPractice && (
        <>
          <StandingCard label="Overall leaderboard" standing={result.overall} />
          <StandingCard label="Today's leaderboard" standing={result.daily} />
        </>
      )}

      <div className="cta-row">
        <a className="btn btn-primary" href={cfg.links.bookingUrl} target="_blank" rel="noreferrer">
          Book 30 minutes with our team
        </a>
        {onPlayAgain && (
          <button className="btn btn-ghost" onClick={onPlayAgain}>
            Play again ({result.maxAttempts - result.attemptsUsed} attempt
            {result.maxAttempts - result.attemptsUsed === 1 ? "" : "s"} left)
          </button>
        )}
      </div>
    </div>
  );
}
