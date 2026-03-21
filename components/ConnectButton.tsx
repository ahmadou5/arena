// src/components/ConnectButton.tsx
// Replaces the placeholder #connect-wallet-btn — shows connect/authenticating/connected states
"use client";
import { useAuth } from "@/providers/AuthProvider";

export default function ConnectButton() {
  const {
    wallet,
    token,
    isConnected,
    isAuthenticating,
    authError,
    connect,
    disconnect,
  } = useAuth();

  // Authenticating — signing in progress
  if (isAuthenticating) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#c8a96e] pulse-dot" />
        <span className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
          Signing…
        </span>
      </div>
    );
  }

  // Connected + authenticated
  if (isConnected && wallet) {
    return (
      <div className="flex items-center gap-3">
        <a
          href={`/trader/${wallet}`}
          className="flex items-center gap-2 font-mono text-xs text-[#2e3d47] hover:text-[#7a9ab0] transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3d7a5c]" />
          {wallet.slice(0, 4)}…{wallet.slice(-4)}
        </a>
        <button
          onClick={disconnect}
          className="font-mono text-[10px] text-[#8a8880] hover:text-[#9b3d3d] uppercase tracking-wider transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Error state
  if (authError) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={connect}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#9b3d3d] text-[#9b3d3d] hover:bg-[#9b3d3d] hover:text-white transition-colors"
          title={authError}
        >
          Retry
        </button>
        <span
          className="font-mono text-[9px] text-[#9b3d3d] max-w-[120px] truncate hidden sm:block"
          title={authError}
        >
          {authError}
        </span>
      </div>
    );
  }

  // Default — not connected
  return (
    <button
      id="connect-wallet-btn"
      onClick={connect}
      className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors"
    >
      Connect
    </button>
  );
}
