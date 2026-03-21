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
  wallet: string | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  openModal: () => void;
  signIn: () => void;
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

// ── Token helpers ─────────────────────────────────────────────────────────────

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
    return exp ? exp * 1000 < Date.now() + 120_000 : false;
  } catch {
    return true;
  }
}

// ── Signature extraction helper ───────────────────────────────────────────────
// Different wallets return different shapes from signMessage:
//   Phantom (Standard Wallet):  Uint8Array                    ← raw bytes
//   Phantom (Legacy):           { signature: Uint8Array }     ← wrapped
//   Solflare:                   Uint8Array                    ← raw bytes
// We normalise all of them to a plain Uint8Array before bs58-encoding.

function extractSignatureBytes(result: unknown): Uint8Array {
  if (result instanceof Uint8Array) {
    return result;
  }
  // Phantom legacy / some adapters wrap it
  if (
    result !== null &&
    typeof result === "object" &&
    "signature" in (result as object)
  ) {
    const sig = (result as { signature: unknown }).signature;
    if (sig instanceof Uint8Array) return sig;
  }
  throw new Error(
    `signMessage returned unexpected type: ${Object.prototype.toString.call(result)}`,
  );
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

  const openModal = useCallback(() => setVisible(true), [setVisible]);

  const signIn = useCallback(async () => {
    if (!wallet || !connected) {
      setError("Wallet not connected");
      setStatus("error");
      return;
    }
    if (!signMessage) {
      setError(
        "This wallet does not support message signing. Try Phantom or Solflare.",
      );
      setStatus("error");
      return;
    }
    if (inFlight.current) return;

    // Use cached token if still valid
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
      // 1. Get nonce
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok)
        throw new Error(`Nonce request failed (${nonceRes.status})`);
      const { nonce } = (await nonceRes.json()) as { nonce?: string };
      if (!nonce) throw new Error("Server returned empty nonce");

      // 2. Build message + sign
      const message = `Arena Protocol login\nNonce: ${nonce}\nWallet: ${wallet}`;
      const msgBytes = new TextEncoder().encode(message);
      const rawResult = await signMessage(msgBytes);

      // 3. Normalise — different wallets return different shapes
      const sigBytes = extractSignatureBytes(rawResult);
      const signedMessage = bs58.encode(sigBytes);

      // 4. Verify on server + get JWT
      const authRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signedMessage, message }),
      });
      if (!authRes.ok)
        throw new Error(`Auth request failed (${authRes.status})`);
      const data = (await authRes.json()) as {
        success: boolean;
        token?: string;
        error?: string;
      };
      if (!data.success || !data.token)
        throw new Error(data.error ?? "Sign-in failed");

      // 5. Store + expose
      writeToken(wallet, data.token);
      setToken(data.token);
      setStatus("authenticated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const userDismissed =
        msg.toLowerCase().includes("reject") ||
        msg.toLowerCase().includes("cancel") ||
        msg.toLowerCase().includes("denied") ||
        msg.toLowerCase().includes("closed");

      if (userDismissed) {
        // User closed the popup — silently back to idle
        setStatus("idle");
        setError(null);
      } else {
        console.error("[auth] signIn error:", err);
        setError(msg);
        setStatus("error");
      }
    } finally {
      inFlight.current = false;
    }
  }, [wallet, connected, signMessage]);

  const signOut = useCallback(() => {
    if (wallet) deleteToken(wallet);
    setToken(null);
    setStatus("idle");
    setError(null);
    disconnect();
  }, [wallet, disconnect]);

  return (
    <AuthContext.Provider
      value={{ wallet, token, status, error, openModal, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
