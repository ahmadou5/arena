// src/components/ConnectButton.tsx
"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/providers/AuthProvider";

export default function ConnectButton() {
  const { connected } = useWallet();
  const { wallet, status, error, openModal, signIn, signOut } = useAuth();

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <button
        onClick={openModal}
        className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-[#2e3d47] text-[#2e3d47] hover:bg-[#2e3d47] hover:text-white transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  // ── Wallet connected, waiting for sign-in ─────────────────────────────────
  if (status === "idle" || status === "error") {
    return (
      <div className="flex items-center gap-2">
        {/* Show error inline above button if sign-in failed */}
        {error && (
          <span
            className="font-mono text-[9px] text-[#9b3d3d] max-w-[160px] truncate hidden sm:block"
            title={error}
          >
            {error}
          </span>
        )}
        <button
          onClick={signIn}
          className="font-mono text-xs uppercase tracking-widest px-4 py-2 bg-[#2e3d47] text-white hover:bg-[#3e5060] transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={signOut}
          className="font-mono text-[10px] text-[#8a8880] hover:text-[#9b3d3d] transition-colors px-1"
          title="Disconnect wallet"
        >
          ×
        </button>
      </div>
    );
  }

  // ── Signing in progress ───────────────────────────────────────────────────
  if (status === "signing") {
    return (
      <div className="flex items-center gap-2 px-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#c8a96e] animate-pulse" />
        <span className="font-mono text-xs text-[#8a8880] uppercase tracking-widest">
          Check wallet…
        </span>
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────
  if (status === "authenticated" && wallet) {
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
          onClick={signOut}
          className="font-mono text-[10px] text-[#8a8880] hover:text-[#9b3d3d] transition-colors uppercase tracking-wider"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return null;
}
