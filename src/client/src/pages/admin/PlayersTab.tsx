import { useEffect, useState } from "react";
import { adminApi, type AdminPlayerRow } from "../../api/adminApi";

type SortBy = "name" | "organization" | "email" | "best_score" | "attempts" | "last_played" | "consent";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlayersTab(): JSX.Element {
  const [players, setPlayers] = useState<AdminPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("last_played");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [wiping, setWiping] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await adminApi.listPlayers({ search: search || undefined, sortBy, sortDir });
      setPlayers(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy, sortDir]);

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  async function handleHideToggle(p: AdminPlayerRow) {
    await adminApi.hidePlayer(p.id, !p.hidden);
    refresh();
  }

  async function handleTestToggle(p: AdminPlayerRow) {
    await adminApi.setTestFlag(p.id, !p.isTest);
    refresh();
  }

  async function handleDelete(p: AdminPlayerRow) {
    if (!window.confirm(`Delete ${p.firstName} ${p.lastName} (${p.email}) and all their attempts? This can't be undone.`)) {
      return;
    }
    await adminApi.deletePlayer(p.id);
    refresh();
  }

  async function handleWipeTestData() {
    const testCount = players.filter((p) => p.isTest).length;
    const confirmed = window.confirm(
      `This permanently deletes every player flagged as test data (at least ${testCount} currently visible) and all of their attempts. Continue?`
    );
    if (!confirmed) return;
    setWiping(true);
    try {
      const result = await adminApi.wipeTestData();
      window.alert(`Deleted ${result.playersDeleted} test player(s).`);
      refresh();
    } finally {
      setWiping(false);
    }
  }

  const sortHeader = (label: string, column: SortBy) => (
    <th onClick={() => toggleSort(column)} className="sortable">
      {label}
      {sortBy === column ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div>
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Search name, organization, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search"
        />
        <div className="spacer" />
        <a className="btn btn-secondary admin-btn" href="/api/admin/export.csv">
          Export CSV
        </a>
        <button className="btn btn-ghost admin-btn" onClick={handleWipeTestData} disabled={wiping}>
          {wiping ? "Wiping…" : "Wipe test data"}
        </button>
      </div>

      {loading && players.length === 0 ? (
        <p>Loading…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              {sortHeader("Name", "name")}
              {sortHeader("Organization", "organization")}
              {sortHeader("Email", "email")}
              {sortHeader("Best score", "best_score")}
              {sortHeader("Attempts", "attempts")}
              {sortHeader("Last played", "last_played")}
              {sortHeader("Consent", "consent")}
              <th>Flags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className={p.isTest ? "row-test" : undefined}>
                <td>
                  {p.firstName} {p.lastName}
                </td>
                <td>{p.organization}</td>
                <td>{p.email}</td>
                <td>{p.bestScore}</td>
                <td>{p.attempts}</td>
                <td>{formatDate(p.lastPlayedAt)}</td>
                <td>{p.consentGiven ? "Yes" : "No"}</td>
                <td>
                  {p.hidden && <span className="badge">Hidden</span>}{" "}
                  {p.isTest && <span className="badge badge-test">Test</span>}
                </td>
                <td className="admin-row-actions">
                  <button className="btn-link" onClick={() => handleHideToggle(p)}>
                    {p.hidden ? "Unhide" : "Hide"}
                  </button>
                  <button className="btn-link" onClick={() => handleTestToggle(p)}>
                    {p.isTest ? "Unmark test" : "Mark test"}
                  </button>
                  <button className="btn-link btn-link-danger" onClick={() => handleDelete(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {players.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="text-center">
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
