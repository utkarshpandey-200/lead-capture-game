import { useClientConfig } from "../../config/ClientConfigContext";

export default function IntroScreen({ onPlay }: { onPlay: () => void }): JSX.Element {
  const cfg = useClientConfig();

  return (
    <div className="screen">
      <header className="brand-header">
        <img src={cfg.brand.logoPath} alt={cfg.brand.name} />
      </header>

      <div className="spacer" />

      <span className="eyebrow-badge">🎮 Live Quiz</span>
      <h1 className="screen-title hero-title">{cfg.copy.quizTitle}</h1>
      <p className="screen-body">{cfg.copy.introHeadline}</p>
      <p className="screen-body">{cfg.copy.introBody}</p>

      <div className="chip-row">
        <span className="chip">❓ {cfg.quiz.questionsPerAttempt} questions</span>
        <span className="chip">⏱ {Math.round(cfg.quiz.questionTimeLimitMs / 1000)}s each</span>
        <span className="chip">🏆 Live leaderboard</span>
      </div>

      <div className="spacer" />

      <button className="btn btn-primary btn-pulse" onClick={onPlay}>
        Play Now
      </button>
    </div>
  );
}
