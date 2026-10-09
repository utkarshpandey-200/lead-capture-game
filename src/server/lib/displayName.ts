import type { PlayerRow } from "../db/players.js";
import type { DisplayMode } from "../../shared/types.js";

export interface DisplaySafeName {
  displayName: string;
  organization: string | null;
}

export interface DisplayNameFields {
  displayMode: DisplayMode;
  displayValue: string | null;
  firstName: string;
  lastName: string;
  organization: string;
}

/** Computes the public-facing name/org pair from raw fields, honoring the chosen display mode. Never leaks email. */
export function computeDisplaySafeNameFromFields(fields: DisplayNameFields): DisplaySafeName {
  switch (fields.displayMode) {
    case "full_name":
      return { displayName: `${fields.firstName} ${fields.lastName}`.trim(), organization: null };
    case "nickname":
      return { displayName: fields.displayValue || fields.firstName, organization: null };
    case "first_org":
    default:
      return { displayName: fields.firstName, organization: fields.organization };
  }
}

export function computeDisplaySafeName(player: PlayerRow): DisplaySafeName {
  return computeDisplaySafeNameFromFields({
    displayMode: player.display_mode,
    displayValue: player.display_value,
    firstName: player.first_name,
    lastName: player.last_name,
    organization: player.organization,
  });
}

/**
 * Stable identity string for "is this the same leaderboard entry" purposes.
 * Two attempts with the same displayed name+organization are treated as
 * the same entry on the public leaderboard (see getLeaderboardAttempts),
 * independent of which player record they came from.
 */
export function displayIdentityKey(name: DisplaySafeName): string {
  return `${name.displayName.trim().toLowerCase()}|${(name.organization ?? "").trim().toLowerCase()}`;
}
