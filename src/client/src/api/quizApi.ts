import { api } from "./client";
import type {
  AnswerOutcome,
  AttemptResult,
  CurrentAttemptResponse,
  DisplayMode,
  MeResponse,
  PublicLeaderboard,
  QuestionForClient,
  RegisterResponse,
  StartAttemptResponse,
} from "../../../shared/types";

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  organization: string;
  /** Optional. Never used to look up an existing player — every registration is a brand-new entry; omitting it just excludes you from the lead export. */
  email?: string;
  consent: boolean;
  displayMode: DisplayMode;
  nickname?: string;
  website?: string; // honeypot — always left blank by real visitors
}

export const quizApi = {
  me: () => api.get<MeResponse>("/api/me"),
  register: (payload: RegisterPayload) => api.post<RegisterResponse>("/api/register", payload),
  logout: () => api.post<{ ok: true }>("/api/logout"),
  startAttempt: (practice = false) => api.post<StartAttemptResponse>("/api/attempts/start", { practice }),
  currentAttempt: () => api.get<CurrentAttemptResponse>("/api/attempts/current"),
  getQuestion: (attemptId: string) =>
    api.get<QuestionForClient>(`/api/attempts/${attemptId}/question`),
  submitAnswer: (
    attemptId: string,
    body: { position: number; questionId: string; chosenOption: number | null; clientElapsedMs: number }
  ) => api.post<AnswerOutcome>(`/api/attempts/${attemptId}/answer`, body),
  getResult: (attemptId: string) => api.get<AttemptResult>(`/api/attempts/${attemptId}/result`),
  leaderboardTop: (board: "overall" | "daily") =>
    api.get<PublicLeaderboard>(`/api/leaderboard/top?board=${board}`),
};
