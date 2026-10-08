import { useEffect } from "react";

/**
 * Traps the browser back button and warns on tab close/reload while
 * `active`, so a mid-quiz player can't accidentally bail out of a timed
 * attempt. Not airtight (a user can still force-close the tab), but it
 * covers the common accidental-navigation case.
 */
export function useBlockBackNavigation(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
