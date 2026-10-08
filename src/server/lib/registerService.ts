import { config } from "../../shared/config.js";
import { checkNickname } from "../../shared/nickname.js";
import type { DisplayMode } from "../../shared/types.js";
import { createPlayer, getPlayerByEmail, updateDisplayPreference, type PlayerRow } from "../db/players.js";
import { countRankedAttempts } from "../db/attempts.js";
import { newId } from "./ids.js";
import { AppError } from "./errors.js";

export interface RegisterParams {
  firstName: string;
  lastName: string;
  organization: string;
  email: string;
  displayMode: DisplayMode;
  nickname?: string;
  isTest?: boolean;
}

export interface RegisterOutcome {
  player: PlayerRow;
  isReturning: boolean;
}

export class InvalidNicknameError extends AppError {
  constructor(reason: string) {
    super(400, "invalid_nickname", `Nickname is not usable: ${reason}`);
  }
}

function resolveDisplayValue(params: RegisterParams): string | null {
  if (params.displayMode !== "nickname") return null;
  const nickname = params.nickname ?? "";
  const check = checkNickname(nickname, config.nicknameBlocklist);
  if (!check.valid) {
    throw new InvalidNicknameError(check.reason ?? "invalid");
  }
  return nickname.trim();
}

/**
 * Registers a new player, or resumes an existing one by email on a new
 * device. On return, personal fields (name/organization) are preserved
 * as originally captured — only the display preference is refreshed —
 * and no stored personal detail is echoed back to the caller.
 */
export function registerOrResume(params: RegisterParams): RegisterOutcome {
  const email = params.email.trim().toLowerCase();
  const existing = getPlayerByEmail(email);

  if (existing) {
    const displayValue = resolveDisplayValue(params);
    updateDisplayPreference(existing.id, params.displayMode, displayValue);
    return { player: { ...existing, display_mode: params.displayMode, display_value: displayValue }, isReturning: true };
  }

  const displayValue = resolveDisplayValue(params);
  const player = createPlayer({
    id: newId(),
    email,
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    organization: params.organization.trim(),
    consentVersion: config.consentVersion,
    consentTimestamp: new Date().toISOString(),
    displayMode: params.displayMode,
    displayValue,
    isTest: params.isTest ?? false,
  });
  return { player, isReturning: false };
}

export function getAttemptsRemaining(playerId: string): number {
  return Math.max(0, config.quiz.maxAttempts - countRankedAttempts(playerId));
}
