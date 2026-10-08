import { useEffect, useState } from "react";
import { adminApi } from "../api/adminApi";
import AdminLogin from "./admin/AdminLogin";
import PlayersTab from "./admin/PlayersTab";
import QuestionsTab from "./admin/QuestionsTab";

type Tab = "players" | "questions";

export default function Admin(): JSX.Element {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<Tab>("players");

  useEffect(() => {
    adminApi
      .whoami()
      .then((res) => setAuthenticated(res.authenticated))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogout() {
    await adminApi.logout();
    setAuthenticated(false);
  }

  if (checking) return <div className="full-page-loading" aria-busy="true" />;
  if (!authenticated) return <AdminLogin onSuccess={() => setAuthenticated(true)} />;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Quiz admin</h1>
        <nav className="admin-tabs">
          <button className={`admin-tab${tab === "players" ? " active" : ""}`} onClick={() => setTab("players")}>
            Players
          </button>
          <button className={`admin-tab${tab === "questions" ? " active" : ""}`} onClick={() => setTab("questions")}>
            Questions
          </button>
        </nav>
        <div className="spacer" />
        <button className="btn-link" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="admin-main">{tab === "players" ? <PlayersTab /> : <QuestionsTab />}</main>
    </div>
  );
}
