import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useClientConfig } from "../config/ClientConfigContext";
import { usePolledLeaderboard } from "../api/leaderboardPoll";
import LeaderboardRows from "./display/LeaderboardRows";

type Board = "overall" | "daily";

export default function Display(): JSX.Element {
  const cfg = useClientConfig();
  const [searchParams] = useSearchParams();
  const boardParam = searchParams.get("board");
  const initialBoard: Board = boardParam === "overall" ? "overall" : "daily";

  const overall = usePolledLeaderboard("overall", cfg.display.pollIntervalMs);
  const daily = usePolledLeaderboard("daily", cfg.display.pollIntervalMs);

  // Manual, click-to-switch — no auto-rotation. ?board=daily|overall just sets which one shows first.
  const [activeBoard, setActiveBoard] = useState<Board>(initialBoard);
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
        <div className="display-board-label" role="tablist" aria-label="Leaderboard">
          <button
            type="button"
            role="tab"
            aria-selected={activeBoard === "daily"}
            className={`board-pill${activeBoard === "daily" ? " active" : ""}`}
            onClick={() => setActiveBoard("daily")}
          >
            Today
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeBoard === "overall"}
            className={`board-pill${activeBoard === "overall" ? " active" : ""}`}
            onClick={() => setActiveBoard("overall")}
          >
            Overall
          </button>
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
            {daily.data ? `${daily.data.playerCount} ${daily.data.playerCount === 1 ? "player" : "players"} today` : " "}
          </div>
        </div>
      </div>

      <div className="display-footer">
        {anyStale && <span className="display-offline-badge">Reconnecting…</span>}
      </div>
    </div>
  );
}
