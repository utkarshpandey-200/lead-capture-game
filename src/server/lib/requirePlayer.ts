import type { FastifyRequest } from "fastify";
import { getPlayerIdFromRequest } from "./session.js";
import { AppError } from "./errors.js";

export class UnauthenticatedError extends AppError {
  constructor() {
    super(401, "unauthenticated", "Register to play before using this endpoint.");
  }
}

export function requirePlayerId(req: FastifyRequest): string {
  const playerId = getPlayerIdFromRequest(req);
  if (!playerId) throw new UnauthenticatedError();
  return playerId;
}
