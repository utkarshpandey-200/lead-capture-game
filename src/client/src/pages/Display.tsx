import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useClientConfig } from "../config/ClientConfigContext";
import { usePolledLeaderboard, useAvailableEventDays } from "../api/leaderboardPoll";
import LeaderboardRows from "./display/LeaderboardRows";

type Board = "overall" | "daily";

function formatEventDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Display(): JSX.Element {
  const cfg = useClientConfig();
  const [searchParams] = useSearchParams();
  const boardParam = searchParams.get("board");
  const initialBoard: Board = boardParam === "overall" ? "overall" : "daily";

  // Manual, click-to-switch — no auto-rotation. ?board=daily|overall just sets which one shows first.
  const [activeBoard, setActiveBoard] = useState<Board>(initialBoard);
  // undefined = "today", resolved server-side; set once the operator picks a specific past day.
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  const overall = usePolledLeaderboard("overall", cfg.display.pollIntervalMs);
  const daily = usePolledLeaderboard("daily", cfg.display.pollIntervalMs, selectedDate);
  const availableDays = useAvailableEventDays();

  const activeResult = activeBoard === "overall" ? overall : daily;
  const active = activeResult.data;
  const anyStale = overall.stale || daily.stale;

  const todayEventDay = daily.data?.board === "daily" && !selectedDate ? daily.data.eventDay : undefined;
  const dateOptions = Array.from(new Set([...(todayEventDay ? [todayEventDay] : []), ...availableDays])).sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="display-page">
      <div className="display-header">
        <div className="display-brand">
          <div className="display-logo-chip">
            <img src={cfg.brand.logoPath} alt={cfg.brand.name} />
          </div>
          <h1>{cfg.copy.quizTitle}</h1>
        </div>
        <div className="display-controls">
          <div className="display-board-label" role="tablist" aria-label="Leaderboard">
            <button
              type="button"
              role="tab"
              aria-selected={activeBoard === "daily"}
              className={`board-pill${activeBoard === "daily" ? " active" : ""}`}
              onClick={() => setActiveBoard("daily")}
            >
              Daily
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
          {activeBoard === "daily" && dateOptions.length > 0 && (
            <select
              className="display-date-select"
              aria-label="Filter by date"
              value={selectedDate ?? todayEventDay ?? dateOptions[0]}
              onChange={(e) => setSelectedDate(e.target.value === todayEventDay ? undefined : e.target.value)}
            >
              {dateOptions.map((day) => (
                <option key={day} value={day}>
                  {formatEventDay(day)}
                  {day === todayEventDay ? " (Today)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="display-body">
        <div className="display-leaderboard">
          {active && active.entries.length > 0 ? (
            <LeaderboardRows entries={active.entries} />
          ) : (
            <div className="display-empty">No scores yet — be the first to play!</div>
          )}
        </div>

        <div className="display-side">
          <div className="display-player-count">
            {daily.data ? `${daily.data.playerCount} ${daily.data.playerCount === 1 ? "player" : "players"}` : " "}
          </div>
        </div>
      </div>

      <div className="display-footer">
        {anyStale && <span className="display-offline-badge">Reconnecting…</span>}
      </div>
    </div>
  );
}
