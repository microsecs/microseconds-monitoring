"use client";

import { createContext, useContext, useMemo, useState } from "react";

type StatusKind = "ready" | "working" | "success" | "error";
type AppStatus = { kind: StatusKind; text: string };
type StatusContextValue = AppStatus & { setStatus: (status: AppStatus) => void };

const StatusContext = createContext<StatusContextValue | null>(null);

export function AppStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AppStatus>({ kind: "ready", text: "Ready" });
  const value = useMemo(() => ({ ...status, setStatus }), [status]);

  return (
    <StatusContext.Provider value={value}>
      {children}
      <div className={`appStatusBar appStatus-${status.kind}`} role="status" aria-live="polite">
        <span className="appStatusDot" aria-hidden="true" />
        <span className="appStatusText">{status.text}</span>
        <span className="appStatusBrand">MicroSECONDS Monitoring</span>
      </div>
    </StatusContext.Provider>
  );
}

export function useAppStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error("useAppStatus must be used inside AppStatusProvider");
  return context;
}
