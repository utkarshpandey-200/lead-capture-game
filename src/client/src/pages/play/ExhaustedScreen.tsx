import { useClientConfig } from "../../config/ClientConfigContext";

export default function ExhaustedScreen({ onPracticeMode }: { onPracticeMode: () => void }): JSX.Element {
  const cfg = useClientConfig();
  return (
    <div className="screen">
      <h1 className="screen-title">You've used your attempts</h1>
      <p className="screen-body">
        You've already played this quiz the maximum number of times. Thanks for playing! You can still try a
        practice round — it won't count toward the leaderboard.
      </p>
      <div className="cta-row">
        <button className="btn btn-primary" onClick={onPracticeMode}>
          Try practice mode
        </button>
        <a className="btn btn-secondary" href={cfg.links.bookingUrl} target="_blank" rel="noreferrer">
          Book 15 minutes with our team
        </a>
      </div>
    </div>
  );
}
