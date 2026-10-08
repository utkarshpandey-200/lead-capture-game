/**
 * A simple in-memory counter bumped whenever a ranked attempt finishes.
 * Lets the display screen poll with an ETag/version and skip re-rendering
 * when nothing has changed. Resetting on server restart is fine — clients
 * always compare against whatever version the current process reports.
 */
let version = 0;

export function bumpLeaderboardVersion(): number {
  version += 1;
  return version;
}

export function getLeaderboardVersion(): number {
  return version;
}
