// src/components/AuthProvider.tsx
"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthStatus = "idle" | "signing" | "authenticated" | "error";

interface AuthContextValue {
  // Wallet public key (available as soon as wallet connects, before sign-in)
  wallet: string | null;
  // JWT token (only available after sign-in)
  token: string | null;
  // Derived status for easy conditional rendering
  status: AuthStatus;
  // Human-readable error if status === "error"
  error: string | null;
  // Open the wallet-select modal
  openModal: () => void;
  // Trigger sign-in after wallet is connected
  signIn: () => void;
  // Disconnect wallet and clear token
  signOut: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  wallet: null,
  token: null,
  status: "idle",
  error: null,
  openModal: () => {},
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── Token helpers (sessionStorage — cleared when tab closes) ──────────────────

const KEY = (wallet: string) => `arena:jwt:${wallet}`;

function readToken(wallet: string): string | null {
  try {
    return sessionStorage.getItem(KEY(wallet));
  } catch {
    return null;
  }
}

function writeToken(wallet: string, token: string) {
  try {
    sessionStorage.setItem(KEY(wallet), token);
  } catch {}
}

function deleteToken(wallet: string) {
  try {
    sessionStorage.removeItem(KEY(wallet));
  } catch {}
}

function tokenExpired(token: string): boolean {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    // Consider expired 2 minutes early to avoid edge-case 401s
    return exp ? exp * 1000 < Date.now() + 120_000 : false;
  } catch {
    return true;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const wallet = publicKey?.toBase58() ?? null;

  // ── openModal: show wallet-select popup ───────────────────────────────────
  const openModal = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  // ── signIn: called after wallet is connected, on user button click ─────────
  const signIn = useCallback(async () => {
    if (!wallet || !connected || !signMessage) return;
    if (inFlight.current) return;

    // Check for a still-valid cached token first — skip signing if possible
    const cached = readToken(wallet);
    if (cached && !tokenExpired(cached)) {
      setToken(cached);
      setStatus("authenticated");
      return;
    }

    inFlight.current = true;
    setStatus("signing");
    setError(null);

    try {
      // Step 1: get a one-time nonce from the server
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("Could not get nonce from server");

      // Step 2: build the message and ask the wallet to sign it
      // This is what triggers the Phantom / Solflare popup
      const message = `Arena Protocol login\nNonce: ${nonce}\nWallet: ${wallet}`;
      const signature = await signMessage(new TextEncoder().encode(message));
      const signedMessage = bs58.encode(signature);

      // Step 3: send signature to server, get JWT back
      const authRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signedMessage, message }),
      });
      const data = await authRes.json();
      if (!data.success) throw new Error(data.error ?? "Sign-in failed");

      // Step 4: store and expose the token
      writeToken(wallet, data.token);
      setToken(data.token);
      setStatus("authenticated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const userRejected =
        msg.toLowerCase().includes("reject") ||
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("denied");
      if (userRejected) {
        // User closed the popup — go back to idle, not an error state
        setStatus("idle");
      } else {
        setError(msg);
        setStatus("error");
        console.error("[auth] sign-in failed:", err);
      }
    } finally {
      inFlight.current = false;
    }
  }, [wallet, connected, signMessage]);

  // ── signOut: disconnect wallet and clear stored token ─────────────────────
  const signOut = useCallback(() => {
    if (wallet) deleteToken(wallet);
    setToken(null);
    setStatus("idle");
    setError(null);
    disconnect();
  }, [wallet, disconnect]);

  return (
    <AuthContext.Provider
      value={{
        wallet,
        token,
        status,
        error,
        openModal,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
