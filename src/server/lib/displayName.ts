import type { PlayerRow } from "../db/players.js";

export interface DisplaySafeName {
  displayName: string;
  organization: string | null;
}

/** Computes the public-facing name/org pair for a player, honoring their chosen display mode. Never leaks email. */
export function computeDisplaySafeName(player: PlayerRow): DisplaySafeName {
  switch (player.display_mode) {
    case "full_name":
      return { displayName: `${player.first_name} ${player.last_name}`.trim(), organization: null };
    case "nickname":
      return { displayName: player.display_value || player.first_name, organization: null };
    case "first_org":
    default:
      return { displayName: player.first_name, organization: player.organization };
  }
}
