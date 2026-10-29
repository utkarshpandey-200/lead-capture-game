export type QuestionType = "knowledge" | "scenario" | "bonus";
export type QuestionStatus = "draft" | "approved";

export interface QuestionSeed {
  id: string;
  category: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  reference: string;
  status: QuestionStatus;
}

export type DisplayMode = "first_org" | "full_name" | "nickname";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  organization: string | null;
  score: number;
  isNew?: boolean;
}

export interface PublicLeaderboard {
  board: "overall" | "daily";
  /** The event day (YYYY-MM-DD) actually served for a "daily" board; omitted for "overall". */
  eventDay?: string;
  generatedAt: string;
  version: number;
  playerCount: number;
  entries: LeaderboardEntry[];
}

export interface StandingSummary {
  rank: number;
  totalPlayers: number;
  topPercent: number;
  pointGapToFifth: number | null;
}

export interface AttemptResult {
  totalScore: number;
  numCorrect: number;
  avgAnswerMs: number;
  overall: StandingSummary;
  daily: StandingSummary;
  attemptsUsed: number;
  maxAttempts: number;
  isPractice: boolean;
}

// --- Wire contracts between the client and the server ---

export interface RegisterResponse {
  firstName: string;
  attemptsRemaining: number;
  maxAttempts: number;
  displayMode: DisplayMode;
  displayValue: string | null;
}

export interface MeResponseAuthenticated {
  authenticated: true;
  firstName: string;
  displayMode: DisplayMode;
  displayValue: string | null;
  attemptsRemaining: number;
  maxAttempts: number;
}

export interface MeResponseAnonymous {
  authenticated: false;
}

export type MeResponse = MeResponseAuthenticated | MeResponseAnonymous;

export interface StartAttemptResponse {
  attemptId: string;
  isPractice: boolean;
}

export interface QuestionForClient {
  attemptId: string;
  position: number;
  totalQuestions: number;
  questionId: string;
  category: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  remainingMs: number;
  servedAt: string;
  scoreSoFar: number;
}

export interface CurrentAttemptResponseActive {
  active: true;
  attemptId: string;
  isPractice: boolean;
  question: QuestionForClient;
}

export interface CurrentAttemptResponseInactive {
  active: false;
}

export type CurrentAttemptResponse = CurrentAttemptResponseActive | CurrentAttemptResponseInactive;

export interface AnswerOutcome {
  correct: boolean;
  correctOptionDisplayIndex: number;
  explanation: string;
  reference: string;
  pointsEarned: number;
  scoreSoFar: number;
  isLastQuestion: boolean;
  nextPosition: number | null;
  /** True when the next question (not yet fetched) is the fixed bonus question — lets the client show its own announcement screen before fetching it. */
  nextIsBonus: boolean;
  result: AttemptResult | null;
}
