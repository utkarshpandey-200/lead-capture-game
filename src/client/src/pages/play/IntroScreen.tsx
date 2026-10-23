import { useClientConfig } from "../../config/ClientConfigContext";

export default function IntroScreen({ onPlay }: { onPlay: () => void }): JSX.Element {
  const cfg = useClientConfig();

  return (
    <div className="screen">
      <header className="brand-header">
        <img src={cfg.brand.logoPath} alt={cfg.brand.name} />
      </header>

      <div className="spacer" />

      <h1 className="screen-title">{cfg.copy.quizTitle}</h1>
      <p className="screen-body">{cfg.copy.introHeadline}</p>
      <p className="screen-body">{cfg.copy.introBody}</p>
      <p className="screen-body">
        {cfg.quiz.questionsPerAttempt} questions &middot; {Math.round(cfg.quiz.questionTimeLimitMs / 1000)}s
        each &middot; scored on accuracy and speed
      </p>

      <div className="spacer" />

      <button className="btn btn-primary" onClick={onPlay}>
        Play
      </button>
    </div>
  );
}
