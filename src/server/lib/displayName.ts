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
