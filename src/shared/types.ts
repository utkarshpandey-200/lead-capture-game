export type QuestionType = "knowledge" | "scenario";
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
