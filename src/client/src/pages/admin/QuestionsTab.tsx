import { useEffect, useRef, useState } from "react";
import { adminApi, type AdminQuestionRow } from "../../api/adminApi";
import { ApiError } from "../../api/client";

export default function QuestionsTab(): JSX.Element {
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      setQuestions(await adminApi.listQuestions());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleStatus(q: AdminQuestionRow) {
    const next = q.status === "approved" ? "draft" : "approved";
    await adminApi.setQuestionStatus(q.id, next);
    refresh();
  }

  async function handleImport() {
    setImportMessage(null);
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      const result = await adminApi.importQuestions(Array.isArray(parsed) ? parsed : [parsed]);
      setImportMessage(`Imported/updated ${result.count} question(s).`);
      setImportText("");
      refresh();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setImportError("That doesn't look like valid JSON.");
      } else if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError("Import failed.");
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  const approvedCount = questions.filter((q) => q.status === "approved").length;

  return (
    <div>
      <div className="admin-import-card">
        <h2>Import questions from JSON</h2>
        <p className="screen-body" style={{ margin: "0 0 var(--space-3)" }}>
          Paste a JSON array of questions (same shape as data/questions.seed.json), or load a file. Existing
          question IDs are updated in place; new IDs are added.
        </p>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} />
        <textarea
          className="admin-json-textarea"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="[{ &quot;id&quot;: &quot;q-example&quot;, ... }]"
          rows={8}
        />
        {importError && <div className="field-error">{importError}</div>}
        {importMessage && <div className="admin-success">{importMessage}</div>}
        <button className="btn btn-primary admin-btn" onClick={handleImport} disabled={!importText.trim()}>
          Import
        </button>
      </div>

      <h2 style={{ marginTop: "var(--space-6)" }}>
        Questions ({approvedCount} approved / {questions.length} total)
      </h2>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Category</th>
              <th>Type</th>
              <th>Difficulty</th>
              <th>Prompt</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td>
                  <span className={`badge ${q.status === "approved" ? "badge-approved" : "badge-draft"}`}>
                    {q.status}
                  </span>
                </td>
                <td>{q.category}</td>
                <td>{q.type}</td>
                <td>{q.difficulty}</td>
                <td className="admin-prompt-cell">{q.prompt}</td>
                <td>
                  <button className="btn-link" onClick={() => toggleStatus(q)}>
                    {q.status === "approved" ? "Revert to draft" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
