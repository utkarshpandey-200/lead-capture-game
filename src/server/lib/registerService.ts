import { config } from "../../shared/config.js";
import { checkNickname } from "../../shared/nickname.js";
import type { DisplayMode } from "../../shared/types.js";
import { createPlayer, type PlayerRow } from "../db/players.js";
import { countRankedAttempts } from "../db/attempts.js";
import { newId } from "./ids.js";
import { AppError } from "./errors.js";

export interface RegisterParams {
  firstName: string;
  lastName: string;
  organization: string;
  /** Optional, and never used to look up an existing player — every registration is a brand-new entry. */
  email?: string;
  displayMode: DisplayMode;
  nickname?: string;
  isTest?: boolean;
}

export interface RegisterOutcome {
  player: PlayerRow;
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
 * Registers a brand-new player every time — email is never used to look up
 * or resume an existing record, even if it matches a prior registration
 * exactly. Every submission is its own unique entry, with its own attempt
 * cap and its own leaderboard row.
 */
export function registerPlayer(params: RegisterParams): RegisterOutcome {
  const email = params.email?.trim().toLowerCase() || null;
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
  return { player };
}

export function getAttemptsRemaining(playerId: string): number {
  return Math.max(0, config.quiz.maxAttempts - countRankedAttempts(playerId));
}
