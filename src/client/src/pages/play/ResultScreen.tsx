import { useClientConfig } from "../../config/ClientConfigContext";
import { useCountUp } from "../../hooks/useCountUp";
import ConfettiBurst from "../../components/ConfettiBurst";
import type { AttemptResult, StandingSummary } from "../../../../shared/types";

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function StandingCard({ label, standing }: { label: string; standing: StandingSummary }): JSX.Element {
  if (standing.totalPlayers === 0) {
    return (
      <div className="standing-card">
        <div>
          <div className="board-name">{label}</div>
          <div className="sub-line">You're the first to play — rankings will fill in soon.</div>
        </div>
      </div>
    );
  }
  const medal = rankMedal(standing.rank);
  return (
    <div className="standing-card">
      {medal && (
        <span className="rank-medal" aria-hidden="true">
          {medal}
        </span>
      )}
      <div>
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
    </div>
  );
}

export default function ResultScreen({ result }: { result: AttemptResult }): JSX.Element {
  const cfg = useClientConfig();
  const animatedScore = useCountUp(result.totalScore);

  return (
    <div className="screen">
      {!result.isPractice && <ConfettiBurst />}

      {result.isPractice && (
        <div className="screen-body" style={{ marginBottom: "var(--space-3)" }}>
          Practice round — not added to the leaderboard.
        </div>
      )}

      <p className="result-score-label">Your score</p>
      <div className="result-score-wrap">
        <p className="result-score">{animatedScore.toLocaleString()}</p>
      </div>
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
        <a className="btn btn-secondary" href={cfg.links.websiteUrl} target="_blank" rel="noreferrer">
          🌐 Visit Website
        </a>
      </div>
    </div>
  );
}
