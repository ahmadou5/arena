// src/components/adrena-integration/TradeClosedToast.tsx
// Adrena UI integration: toast notification after trade close — "+N CPS earned"
// Team: call showCpsToast(cps) when a position close event fires
// Integration point: wherever Adrena fires position-close confirmation events
"use client";
import { useState, useEffect, useCallback } from "react";

interface ToastState {
  id: number;
  cps: number;
  visible: boolean;
  gauntlet: boolean;
}

let toastId = 0;
const listeners: Array<(cps: number, gauntlet: boolean) => void> = [];

// Public API — call from Adrena trade-close handler
export function showCpsToast(cps: number, gauntlet = false) {
  listeners.forEach((fn) => fn(cps, gauntlet));
}

function formatCps(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export default function TradeClosedToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const addToast = useCallback((cps: number, gauntlet: boolean) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, cps, visible: true, gauntlet }]);
    // Auto-dismiss after 4s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
      );
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        400,
      );
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const i = listeners.indexOf(addToast);
      if (i !== -1) listeners.splice(i, 1);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 bg-[#2e3d47] text-white shadow-lg min-w-[220px]"
          style={{
            transition: "all 0.3s ease-out",
            opacity: toast.visible ? 1 : 0,
            transform: toast.visible ? "translateX(0)" : "translateX(24px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <span className="text-base">{toast.cps >= 0 ? "▲" : "▼"}</span>
          <div className="flex-1">
            <p
              className="font-mono text-xs font-semibold"
              style={{ color: toast.cps >= 0 ? "#c8a96e" : "#9b8080" }}
            >
              {toast.cps >= 0 ? "+" : ""}
              {formatCps(toast.cps)} CPS earned
            </p>
            <p className="font-mono text-[9px] text-[#8a9aaa]">
              {toast.gauntlet
                ? "⚡ Gauntlet 1.5x bonus applied"
                : "Position closed"}
            </p>
          </div>
          <span className="font-mono text-[10px] text-[#6a8090]">Arena</span>
        </div>
      ))}
    </div>
  );
}
