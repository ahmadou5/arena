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

interface AuthContextValue {
  wallet: string | null;
  token: string | null;
  isConnected: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  connect: () => void;
  disconnect: () => void;
  triggerAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  wallet: null,
  token: null,
  isConnected: false,
  isAuthenticating: false,
  authError: null,
  connect: () => {},
  disconnect: () => {},
  triggerAuth: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

function saveToken(wallet: string, token: string) {
  try {
    sessionStorage.setItem(`arena_jwt_${wallet}`, token);
  } catch {}
}
function loadToken(wallet: string): string | null {
  try {
    return sessionStorage.getItem(`arena_jwt_${wallet}`);
  } catch {
    return null;
  }
}
function clearToken(wallet: string) {
  try {
    sessionStorage.removeItem(`arena_jwt_${wallet}`);
  } catch {}
}
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 > Date.now() + 60_000 : true;
  } catch {
    return false;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    publicKey,
    signMessage,
    disconnect: walletDisconnect,
    connected,
  } = useWallet();
  const { setVisible } = useWalletModal();

  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authInProgress = useRef(false);

  const walletAddress = publicKey?.toBase58() ?? null;

  // Auth is triggered ONLY by explicit user action — never automatically on load
  const triggerAuth = useCallback(async () => {
    const wallet = publicKey?.toBase58();
    if (!wallet || !connected) return;
    if (authInProgress.current) return;
    authInProgress.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Check cached token first
      const cached = loadToken(wallet);
      if (cached && isTokenValid(cached)) {
        setToken(cached);
        return;
      }

      // Get nonce
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("No nonce returned");

      // Build + sign message
      const message = `Arena Protocol login\nNonce: ${nonce}\nWallet: ${wallet}`;
      if (!signMessage)
        throw new Error("Wallet does not support message signing");

      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      const signedMessage = bs58.encode(signature);

      // Register / login
      const authRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signedMessage, message }),
      });
      const authData = await authRes.json();
      if (!authData.success)
        throw new Error(authData.error ?? "Authentication failed");

      saveToken(wallet, authData.token);
      setToken(authData.token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't show rejection as error — user cancelled intentionally
      if (!msg.includes("rejected") && !msg.includes("User rejected")) {
        setAuthError(msg);
      }
    } finally {
      setIsAuthenticating(false);
      authInProgress.current = false;
    }
  }, [publicKey, connected, signMessage]);

  const connect = useCallback(() => setVisible(true), [setVisible]);

  const disconnect = useCallback(() => {
    if (walletAddress) clearToken(walletAddress);
    setToken(null);
    setAuthError(null);
    walletDisconnect();
  }, [walletAddress, walletDisconnect]);

  // If wallet is connected but no token yet — show "Sign in" button via isConnected=false
  const isConnected = connected && !!token;

  return (
    <AuthContext.Provider
      value={{
        wallet: walletAddress,
        token,
        isConnected,
        isAuthenticating,
        authError,
        connect,
        disconnect,
        triggerAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
