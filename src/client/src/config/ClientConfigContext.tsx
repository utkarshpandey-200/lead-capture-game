import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { PublicConfig } from "../../../shared/config";

const ClientConfigContext = createContext<PublicConfig | null>(null);

function applyBrandCssVariables(cfg: PublicConfig): void {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", cfg.brand.primaryColor);
  root.style.setProperty("--brand-secondary", cfg.brand.secondaryColor);
  root.style.setProperty("--brand-accent", cfg.brand.accentColor);
}

export function ClientConfigProvider({ children }: { children: ReactNode }): JSX.Element {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);

  useEffect(() => {
    api
      .get<PublicConfig>("/api/config")
      .then((result) => {
        applyBrandCssVariables(result);
        document.title = result.copy.quizTitle;
        setCfg(result);
      })
      .catch(() => {
        // Fall through — ClientConfigProvider renders nothing until config loads.
        // A sustained failure here means the API is unreachable, which the rest
        // of the app will also surface when it tries to register/play.
      });
  }, []);

  if (!cfg) {
    return <div className="full-page-loading" aria-busy="true" aria-label="Loading" />;
  }

  return <ClientConfigContext.Provider value={cfg}>{children}</ClientConfigContext.Provider>;
}

export function useClientConfig(): PublicConfig {
  const ctx = useContext(ClientConfigContext);
  if (!ctx) throw new Error("useClientConfig must be used within ClientConfigProvider");
  return ctx;
}
