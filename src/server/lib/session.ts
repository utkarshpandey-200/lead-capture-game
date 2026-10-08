import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../shared/config.js";

export const PLAYER_COOKIE = "pid";
export const ADMIN_COOKIE = "admin_session";

const isProd = process.env.NODE_ENV === "production";

export function playerCookieOptions(maxAgeMs: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    signed: true,
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export function setPlayerSession(reply: FastifyReply, playerId: string): void {
  reply.setCookie(PLAYER_COOKIE, playerId, playerCookieOptions(config.server.sessionTtlMs));
}

export function getPlayerIdFromRequest(req: FastifyRequest): string | null {
  const raw = req.cookies[PLAYER_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function adminCookieOptions(maxAgeMs: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    signed: true,
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export function setAdminSession(reply: FastifyReply, token: string): void {
  reply.setCookie(ADMIN_COOKIE, token, adminCookieOptions(config.server.adminSessionTtlMs));
}

export function getAdminTokenFromRequest(req: FastifyRequest): string | null {
  const raw = req.cookies[ADMIN_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

export function clearAdminSession(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: "/" });
}
