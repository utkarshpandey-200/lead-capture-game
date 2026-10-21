import { api } from "./client";

export interface AdminPlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  organization: string;
  email: string | null;
  bestScore: number;
  attempts: number;
  lastPlayedAt: string | null;
  firstPlayedAt: string | null;
  consentGiven: boolean;
  consentTimestamp: string;
  hidden: boolean;
  isTest: boolean;
  createdAt: string;
}

export interface AdminQuestionRow {
  id: string;
  category: string;
  type: "knowledge" | "scenario";
  difficulty: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference: string;
  status: "draft" | "approved";
}

export const adminApi = {
  whoami: () => api.get<{ authenticated: boolean }>("/api/admin/whoami"),
  login: (password: string) => api.post<{ ok: true }>("/api/admin/login", { password }),
  logout: () => api.post<{ ok: true }>("/api/admin/logout"),

  listPlayers: (params: { search?: string; sortBy?: string; sortDir?: "asc" | "desc" }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    if (params.sortDir) qs.set("sortDir", params.sortDir);
    return api.get<AdminPlayerRow[]>(`/api/admin/players?${qs.toString()}`);
  },
  hidePlayer: (id: string, hidden: boolean) => api.post<{ ok: true }>(`/api/admin/players/${id}/hide`, { hidden }),
  setTestFlag: (id: string, isTest: boolean) =>
    api.post<{ ok: true }>(`/api/admin/players/${id}/test-flag`, { isTest }),
  deletePlayer: (id: string) =>
    fetch(`/api/admin/players/${id}`, { method: "DELETE", credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error("Delete failed");
    }),
  wipeTestData: () => api.post<{ ok: true; playersDeleted: number }>("/api/admin/wipe-test-data", { confirm: true }),

  listQuestions: () => api.get<AdminQuestionRow[]>("/api/admin/questions"),
  setQuestionStatus: (id: string, status: "draft" | "approved") =>
    api.post<{ ok: true }>(`/api/admin/questions/${id}/status`, { status }),
  importQuestions: (questions: unknown[]) =>
    api.post<{ ok: true; count: number }>("/api/admin/questions/import", questions),
};
