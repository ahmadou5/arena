// src/components/AuthProvider.tsx
// Handles: wallet connect → sign message → POST /api/auth/register → JWT storage
// Provides wallet + token to all child components via context
"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  wallet: string | null;
  token: string | null;
  isConnected: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  connect: () => void;
  disconnect: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  wallet: null,
  token: null,
  isConnected: false,
  isAuthenticating: false,
  authError: null,
  connect: () => {},
  disconnect: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── JWT storage helpers ───────────────────────────────────────────────────────

const TOKEN_KEY = "arena_jwt";

function saveToken(wallet: string, token: string) {
  try {
    sessionStorage.setItem(`${TOKEN_KEY}_${wallet}`, token);
  } catch {}
}
function loadToken(wallet: string): string | null {
  try {
    return sessionStorage.getItem(`${TOKEN_KEY}_${wallet}`);
  } catch {
    return null;
  }
}
function clearToken(wallet: string) {
  try {
    sessionStorage.removeItem(`${TOKEN_KEY}_${wallet}`);
  } catch {}
}

function isTokenValid(token: string): boolean {
  try {
    // Decode JWT payload (no verification — server verifies)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 > Date.now() : true;
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

  // ── Auto-authenticate when wallet connects ────────────────────────────────
  const authenticate = useCallback(
    async (wallet: string) => {
      if (authInProgress.current) return;
      authInProgress.current = true;
      setIsAuthenticating(true);
      setAuthError(null);

      try {
        // 1. Check for valid cached token first
        const cached = loadToken(wallet);
        if (cached && isTokenValid(cached)) {
          setToken(cached);
          return;
        }

        // 2. Get nonce
        const nonceRes = await fetch("/api/auth/nonce");
        const nonceData = await nonceRes.json();
        if (!nonceData.nonce) throw new Error("Failed to get nonce");

        // 3. Build message
        const message = [
          "Arena Protocol login",
          `Nonce: ${nonceData.nonce}`,
          `Wallet: ${wallet}`,
        ].join("\n");

        // 4. Sign with wallet
        if (!signMessage)
          throw new Error("Wallet does not support message signing");
        const encoded = new TextEncoder().encode(message);
        const signature = await signMessage(encoded);
        const signedMessage = bs58.encode(signature);

        // 5. Register / login
        const authRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, signedMessage, message }),
        });
        const authData = await authRes.json();

        if (!authData.success)
          throw new Error(authData.error ?? "Authentication failed");

        // 6. Store token
        saveToken(wallet, authData.token);
        setToken(authData.token);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Authentication failed";
        // User rejected the signature — don't show as error
        if (msg.includes("User rejected") || msg.includes("rejected")) {
          setAuthError("Signature rejected — please try again");
        } else {
          setAuthError(msg);
        }
        console.error("[auth] authentication failed:", err);
      } finally {
        setIsAuthenticating(false);
        authInProgress.current = false;
      }
    },
    [signMessage],
  );

  // Run auth when wallet connects
  useEffect(() => {
    if (connected && walletAddress) {
      authenticate(walletAddress);
    } else if (!connected) {
      setToken(null);
      setAuthError(null);
    }
  }, [connected, walletAddress, authenticate]);

  const connect = useCallback(() => setVisible(true), [setVisible]);
  const disconnect = useCallback(() => {
    if (walletAddress) clearToken(walletAddress);
    setToken(null);
    walletDisconnect();
  }, [walletAddress, walletDisconnect]);

  return (
    <AuthContext.Provider
      value={{
        wallet: walletAddress,
        token,
        isConnected: connected && !!token,
        isAuthenticating,
        authError,
        connect,
        disconnect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
