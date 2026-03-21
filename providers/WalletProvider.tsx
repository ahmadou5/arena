// src/components/WalletProvider.tsx
"use client";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Phantom self-registers via Standard Wallet protocol — no adapter needed.
  // Solflare still needs an explicit adapter.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      {/*
        autoConnect={false}:
        We never auto-connect on load. The user must click Connect,
        pick a wallet, then click Sign In. This prevents the wallet
        extension firing signMessage without user interaction (which crashes).
      */}
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
