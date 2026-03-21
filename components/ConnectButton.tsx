// src/components/ConnectButton.tsx
"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/providers/AuthProvider";

export default function ConnectButton() {
  const { connected } = useWallet();
  const {
    wallet,
    token,
    isAuthenticating,
    authError,
    connect,
    disconnect,
    triggerAuth,
  } = useAuth();

  // 1. Not connected at all
  if (!connected) {
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

  // 2. Connected wallet, signing in progress
  if (isAuthenticating) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#c8a96e] pulse-dot" />
        <span className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
          Signing…
        </span>
      </div>
    );
  }

  // 3. Connected wallet, not yet signed in — show "Sign In" prompt
  if (connected && !token) {
    return (
      <div className="flex items-center gap-2">
        {authError && (
          <span
            className="font-mono text-[9px] text-[#9b3d3d] hidden sm:block max-w-[140px] truncate"
            title={authError}
          >
            {authError}
          </span>
        )}
        <button
          onClick={triggerAuth}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 bg-[#2e3d47] text-white hover:bg-[#3e5060] transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={disconnect}
          className="font-mono text-[10px] text-[#8a8880] hover:text-[#9b3d3d] uppercase tracking-wider transition-colors"
        >
          ×
        </button>
      </div>
    );
  }

  // 4. Fully authenticated
  if (wallet && token) {
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

  return null;
}
