import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useClientConfig } from "../config/ClientConfigContext";
import { usePolledLeaderboard } from "../api/leaderboardPoll";
import LeaderboardRows from "./display/LeaderboardRows";

type Board = "overall" | "daily";

export default function Display(): JSX.Element {
  const cfg = useClientConfig();
  const [searchParams] = useSearchParams();
  const lockedParam = searchParams.get("board");
  const locked: Board | null = lockedParam === "daily" || lockedParam === "overall" ? lockedParam : null;

  const overall = usePolledLeaderboard("overall", cfg.display.pollIntervalMs);
  const daily = usePolledLeaderboard("daily", cfg.display.pollIntervalMs);

  const [autoBoard, setAutoBoard] = useState<Board>("daily");
  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => {
      setAutoBoard((b) => (b === "overall" ? "daily" : "overall"));
    }, cfg.display.boardRotateMs);
    return () => clearInterval(id);
  }, [locked, cfg.display.boardRotateMs]);

  const activeBoard = locked ?? autoBoard;
  const activeResult = activeBoard === "overall" ? overall : daily;
  const active = activeResult.data;
  const anyStale = overall.stale || daily.stale;

  const playUrl = cfg.links.playBaseUrl;

  return (
    <div className="display-page">
      <div className="display-header">
        <div className="display-brand">
          <img src={cfg.brand.logoPath} alt={cfg.brand.name} />
          <h1>{cfg.copy.quizTitle}</h1>
        </div>
        <div className="display-board-label">
          <span className={`board-pill${activeBoard === "daily" ? " active" : ""}`}>Today</span>
          <span className={`board-pill${activeBoard === "overall" ? " active" : ""}`}>Overall</span>
        </div>
      </div>

      <div className="display-body">
        <div className="display-leaderboard">
          {active && active.entries.length > 0 ? (
            <LeaderboardRows entries={active.entries} />
          ) : (
            <div className="display-empty">Be the first to play — scan the code to start!</div>
          )}
        </div>

        <div className="display-side">
          <div className="display-qr-card">
            <QRCodeSVG
              value={playUrl}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f1418"
              level="M"
              marginSize={2}
              title="Scan to play the quiz"
            />
            <p className="display-cta">{cfg.copy.boothCta}</p>
          </div>
          <div className="display-player-count">
            {daily.data ? `${daily.data.playerCount} players today` : " "}
          </div>
        </div>
      </div>

      <div className="display-footer">
        {anyStale && <span className="display-offline-badge">Reconnecting…</span>}
      </div>
    </div>
  );
}
