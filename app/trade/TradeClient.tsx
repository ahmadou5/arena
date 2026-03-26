// src/app/trade/TradeClient.tsx
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useAuth } from "@/providers/AuthProvider";
import ConnectButton from "@/components/ConnectButton";
import TradingChart from "@/components/TradingChart";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeQuote {
  collateralAmount: number;
  collateralToken: string;
  token: string;
  leverage?: number;
  size?: number;
  entryPrice?: number;
  liquidationPrice?: number;
  fee: number;
  takeProfit?: number | null;
  stopLoss?: number | null;
}

interface OpenPosition {
  positionId: number;
  symbol: string;
  side: string;
  entryPrice: number | null;
  entrySize: number | null;
  entryLeverage: number | null;
  entryDate: string | null;
  collateralAmount: number | null;
  fees: number | null;
}

interface ClosedPosition {
  positionId: number;
  symbol: string;
  side: string;
  pnl: number | null;
  entryDate: string | null;
  exitDate: string | null;
  fees: number | null;
  collateralAmount: number | null;
  cpsEarned: number | null;
}

interface TradePageData {
  ok: boolean;
  season: {
    seasonNumber: number;
    name: string;
    startTs: string;
    endTs: string;
  } | null;
  seasonDay: number | null;
  isGauntlet: boolean;
  openPositions: OpenPosition[];
  recentClosed: ClosedPosition[];
}

type TxStatus =
  | "idle"
  | "quoting"
  | "signing"
  | "sending"
  | "confirmed"
  | "error";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKETS = [
  { symbol: "SOL", label: "SOL-PERP", collateral: "USDC" },
  { symbol: "BTC", label: "BTC-PERP", collateral: "USDC" },
  { symbol: "ETH", label: "ETH-PERP", collateral: "USDC" },
  { symbol: "BONK", label: "BONK-PERP", collateral: "USDC" },
  { symbol: "JTO", label: "JTO-PERP", collateral: "USDC" },
];

// SPL token mint addresses (mainnet)
const TOKEN_MINTS: Record<string, string> = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  // SOL is native — handled separately via getBalance
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCps(n: number | null) {
  if (n === null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
function fmtUsd(n: number | null) {
  if (n === null || isNaN(n)) return "—";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDuration(from: string | null, to?: string | null) {
  if (!from) return "—";
  const h =
    ((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) /
    3_600_000;
  if (h < 1) return `${Math.floor(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function calculateRAR(
  pnl: number,
  fees: number,
  collateral: number,
  hours: number,
) {
  const floor = Math.max(
    Math.abs(Math.min(0, pnl)),
    fees * 0.1,
    collateral * 0.001,
    0.01,
  );
  const rar = (pnl / floor) * Math.log(1 + hours);
  return Math.min(Math.max(rar, -10), 10) * 1_000_000;
}

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-[#dddbd5]" />
      {right && (
        <span className="font-mono text-[10px] text-[#b0aea5]">{right}</span>
      )}
    </div>
  );
}

// ── useTokenBalance hook ──────────────────────────────────────────────────────
// Fetches on-chain wallet balance for SOL or any SPL token.
// Returns { balance, loading } where balance is in human-readable units.

function useTokenBalance(tokenSymbol: string) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      if (tokenSymbol === "SOL") {
        // Native SOL balance
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } else {
        const mintAddress = TOKEN_MINTS[tokenSymbol];
        if (!mintAddress) {
          setBalance(null);
          return;
        }

        // Find the associated token account for this mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint: new PublicKey(mintAddress) },
        );

        if (tokenAccounts.value.length === 0) {
          setBalance(0);
        } else {
          const amount =
            tokenAccounts.value[0].account.data.parsed.info.tokenAmount
              .uiAmount ?? 0;
          setBalance(amount);
        }
      }
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, tokenSymbol]);

  // Fetch on mount and whenever wallet or token changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}

// ── Transaction executor ──────────────────────────────────────────────────────

function useTradeTx() {
  const { connection } = useConnection();
  const { signTransaction, publicKey } = useWallet();

  const execute = useCallback(
    async (
      txBase64: string,
      onStatus: (s: TxStatus, detail?: string) => void,
    ) => {
      if (!signTransaction || !publicKey)
        throw new Error("Wallet not connected");

      onStatus("signing");
      const txBytes = Buffer.from(txBase64, "base64");

      let signed: Transaction | VersionedTransaction;
      try {
        const vtx = VersionedTransaction.deserialize(txBytes);
        signed = await signTransaction(vtx);
      } catch {
        const tx = Transaction.from(txBytes);
        signed = await signTransaction(tx);
      }

      onStatus("sending");
      const raw =
        signed instanceof VersionedTransaction
          ? signed.serialize()
          : (signed as Transaction).serialize();

      const sig = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(sig, "confirmed");
      onStatus("confirmed", sig);
      return sig;
    },
    [connection, signTransaction, publicKey],
  );

  return { execute };
}

// ── Balance badge ─────────────────────────────────────────────────────────────

function BalanceBadge({
  token,
  onMax,
}: {
  token: string;
  onMax: (amount: number) => void;
}) {
  const { balance, loading, refetch } = useTokenBalance(token);

  const handleMax = () => {
    if (balance === null) return;
    // Leave a small buffer for SOL to cover tx fees
    const safeBalance = token === "SOL" ? Math.max(0, balance - 0.01) : balance;
    onMax(Math.floor(safeBalance * 100) / 100);
  };

  return (
    <div className="flex items-center justify-between mb-1.5">
      <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
        Collateral ({token})
      </label>
      <div className="flex items-center gap-1.5">
        {loading ? (
          <span className="font-mono text-[10px] text-[#b0aea5]">…</span>
        ) : balance !== null ? (
          <>
            <span className="font-mono text-[10px] text-[#8a8880]">
              Bal:{" "}
              <span className="text-[#2e3d47] font-semibold">
                {balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: token === "SOL" ? 4 : 2,
                })}{" "}
                {token}
              </span>
            </span>
            <button
              onClick={handleMax}
              className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 transition-colors"
              style={{
                border: "1px solid #dddbd5",
                color: "#2e3d47",
                borderRadius: 3,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "#2e3d47";
                (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#2e3d47";
              }}
            >
              Max
            </button>
            <button
              onClick={refetch}
              className="font-mono text-[10px] text-[#b0aea5] hover:text-[#2e3d47] transition-colors leading-none"
              title="Refresh balance"
            >
              ↻
            </button>
          </>
        ) : (
          <span className="font-mono text-[10px] text-[#b0aea5]">—</span>
        )}
      </div>
    </div>
  );
}

// ── Available margin row ──────────────────────────────────────────────────────
// Derived from open positions: total collateral locked vs wallet balance

function MarginSummary({
  openPositions,
  collateralToken,
  walletBalance,
}: {
  openPositions: OpenPosition[];
  collateralToken: string;
  walletBalance: number | null;
}) {
  // Sum collateral locked in open positions for this token
  const locked = openPositions
    .filter((p) =>
      collateralToken === "SOL"
        ? p.side === "long" && p.symbol === "SOL"
        : p.side === "short" || p.symbol !== "SOL",
    )
    .reduce((sum, p) => sum + (p.collateralAmount ?? 0), 0);

  const available =
    walletBalance !== null ? Math.max(0, walletBalance - locked) : null;

  if (walletBalance === null && locked === 0) return null;

  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{
        background: "#f7f6f2",
        border: "1px solid #dddbd5",
        borderRadius: 4,
      }}
    >
      <div className="flex items-center gap-4">
        <div>
          <p className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest mb-0.5">
            Wallet
          </p>
          <p className="font-mono text-xs font-semibold text-[#2e3d47]">
            {walletBalance !== null
              ? `${walletBalance.toLocaleString("en-US", { maximumFractionDigits: collateralToken === "SOL" ? 4 : 2 })} ${collateralToken}`
              : "—"}
          </p>
        </div>
        <span className="text-[#dddbd5] text-sm">–</span>
        <div>
          <p className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest mb-0.5">
            In Positions
          </p>
          <p className="font-mono text-xs font-semibold text-[#9b3d3d]">
            {locked > 0
              ? `${locked.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${collateralToken}`
              : "—"}
          </p>
        </div>
        <span className="text-[#dddbd5] text-sm">=</span>
        <div>
          <p className="font-mono text-[9px] text-[#b0aea5] uppercase tracking-widest mb-0.5">
            Available
          </p>
          <p className="font-mono text-xs font-semibold text-[#3d7a5c]">
            {available !== null
              ? `${available.toLocaleString("en-US", { maximumFractionDigits: collateralToken === "SOL" ? 4 : 2 })} ${collateralToken}`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Trade form ────────────────────────────────────────────────────────────────

function TradeForm({
  wallet,
  isGauntlet,
  onMarketChange,
  openPositions,
}: {
  wallet: string;
  isGauntlet: boolean;
  onMarketChange?: (m: string) => void;
  openPositions: OpenPosition[];
}) {
  const { execute } = useTradeTx();

  const [market, setMarket] = useState("SOL");
  const [side, setSide] = useState<"long" | "short">("long");
  const [collateral, setCollateral] = useState(50);
  const [leverage, setLeverage] = useState(2);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txPending, setTxPending] = useState<string | null>(null);

  const mkt = MARKETS.find((m) => m.symbol === market) ?? MARKETS[0];
  const collateralToken = side === "short" ? "USDC" : mkt.collateral;

  // Live wallet balance for the current collateral token
  const { balance: walletBalance } = useTokenBalance(collateralToken);

  const fetchQuote = useCallback(async () => {
    setQuote(null);
    setTxError(null);
    if (!collateral || collateral <= 0) return;
    setTxStatus("quoting");
    try {
      const action = side === "long" ? "open-long" : "open-short";
      const params = new URLSearchParams({
        action,
        account: wallet,
        collateralAmount: String(collateral),
        collateralTokenSymbol: collateralToken,
        tokenSymbol: market,
        leverage: String(leverage),
        ...(takeProfit ? { takeProfit } : {}),
        ...(stopLoss ? { stopLoss } : {}),
      });
      const r = await fetch(`/api/trade/quote?${params}`);
      const d = await r.json();
      if (d.ok) {
        setQuote(d.quote);
        setTxPending(d.transaction);
        setTxStatus("idle");
      } else {
        setTxError(d.error ?? "Quote failed");
        setTxStatus("error");
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Network error");
      setTxStatus("error");
    }
  }, [
    wallet,
    market,
    side,
    collateral,
    leverage,
    takeProfit,
    stopLoss,
    collateralToken,
  ]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchQuote, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuote]);

  const handleTrade = async () => {
    if (!txPending) return;
    setTxError(null);
    setTxSig(null);
    try {
      await execute(txPending, (status, detail) => {
        setTxStatus(status);
        if (status === "confirmed" && detail) setTxSig(detail);
        if (status === "error" && detail) setTxError(detail);
      });
      setTimeout(fetchQuote, 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const dismissed =
        msg.toLowerCase().includes("reject") ||
        msg.toLowerCase().includes("cancel");
      if (!dismissed) setTxError(msg);
      setTxStatus("idle");
    }
  };

  const posSize = collateral * leverage;
  const estPnl = posSize * 0.05;
  const estFees = quote?.fee ?? posSize * 0.001;
  const estCps = calculateRAR(estPnl, estFees, collateral, 24);
  const finalCps = isGauntlet ? estCps * 1.5 : estCps;

  // Warn if collateral exceeds wallet balance
  const isOverBalance = walletBalance !== null && collateral > walletBalance;

  const isTrading = ["quoting", "signing", "sending"].includes(txStatus);
  const btnLabel =
    txStatus === "quoting"
      ? "Getting quote…"
      : txStatus === "signing"
        ? "Check wallet…"
        : txStatus === "sending"
          ? "Sending…"
          : `${side === "long" ? "▲" : "▼"} Open ${side} ${market}`;

  return (
    <div className="bg-white border border-[#dddbd5]">
      <div className="px-5 py-3.5 border-b border-[#dddbd5] flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
          Open Position
        </span>
        {isGauntlet && (
          <span className="font-mono text-[10px] text-[#c8a96e] uppercase tracking-wider flex items-center gap-1">
            ⚡ 1.5× Gauntlet
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Market + Side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest block mb-1.5">
              Market
            </label>
            <select
              value={market}
              onChange={(e) => {
                setMarket(e.target.value);
                onMarketChange?.(e.target.value);
              }}
              className="w-full font-mono text-sm px-3 py-2 border border-[#dddbd5] bg-white focus:outline-none focus:border-[#2e3d47] transition-colors"
            >
              {MARKETS.map((m) => (
                <option key={m.symbol} value={m.symbol}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest block mb-1.5">
              Direction
            </label>
            <div className="flex">
              {(["long", "short"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 font-mono text-xs uppercase tracking-widest py-2 border transition-colors ${
                    side === s
                      ? s === "long"
                        ? "bg-[#3d7a5c] text-white border-[#3d7a5c]"
                        : "bg-[#9b3d3d] text-white border-[#9b3d3d]"
                      : "border-[#dddbd5] text-[#8a8880] hover:border-[#2e3d47]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Margin summary — wallet / locked / available */}
        <MarginSummary
          openPositions={openPositions}
          collateralToken={collateralToken}
          walletBalance={walletBalance}
        />

        {/* Collateral input with live balance + Max button */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <BalanceBadge
              token={collateralToken}
              onMax={(amount) => setCollateral(amount)}
            />
            <input
              type="number"
              min="1"
              step="1"
              value={collateral}
              onChange={(e) => setCollateral(Number(e.target.value))}
              className="w-full font-mono text-sm px-3 py-2 border bg-white focus:outline-none transition-colors"
              style={{
                borderColor: isOverBalance ? "#9b3d3d" : "#dddbd5",
              }}
            />
            {isOverBalance && (
              <p className="font-mono text-[9px] text-[#9b3d3d] mt-1">
                Exceeds wallet balance
              </p>
            )}
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                Leverage
              </label>
              <span className="font-mono text-[10px] text-[#2e3d47] font-semibold">
                {leverage}×
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full mt-2 accent-[#2e3d47]"
            />
          </div>
        </div>

        {/* TP / SL */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] text-[#3d7a5c] uppercase tracking-widest block mb-1.5">
              Take Profit (USD)
            </label>
            <input
              type="number"
              placeholder="Optional"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full font-mono text-sm px-3 py-2 border border-[#dddbd5] bg-white focus:outline-none focus:border-[#3d7a5c] transition-colors"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-[#9b3d3d] uppercase tracking-widest block mb-1.5">
              Stop Loss (USD)
            </label>
            <input
              type="number"
              placeholder="Optional"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full font-mono text-sm px-3 py-2 border border-[#dddbd5] bg-white focus:outline-none focus:border-[#9b3d3d] transition-colors"
            />
          </div>
        </div>

        {/* Quote details */}
        {quote && (
          <div className="border border-[#dddbd5] divide-y divide-[#dddbd5]">
            {[
              { label: "Position Size", value: fmtUsd(posSize) },
              {
                label: "Entry Price",
                value: quote.entryPrice
                  ? `$${quote.entryPrice.toLocaleString()}`
                  : "—",
              },
              {
                label: "Liquidation Price",
                value: quote.liquidationPrice
                  ? `$${quote.liquidationPrice.toLocaleString()}`
                  : "—",
                color: "#9b3d3d",
              },
              { label: "Fee", value: fmtUsd(quote.fee) },
              {
                label: `Est. CPS (24h)${isGauntlet ? " ×1.5" : ""}`,
                value: `+${fmtCps(finalCps)}`,
                color: "#2e3d47",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
                  {row.label}
                </span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: row.color ?? "#2e3d47" }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {txError && (
          <div className="px-3 py-2 border border-[#9b3d3d30] bg-[#9b3d3d08]">
            <p className="font-mono text-[10px] text-[#9b3d3d]">{txError}</p>
          </div>
        )}

        {/* Confirmed */}
        {txStatus === "confirmed" && txSig && (
          <div className="px-3 py-2 border border-[#3d7a5c30] bg-[#3d7a5c08] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#3d7a5c] uppercase tracking-widest">
              ✓ Transaction confirmed
            </span>
            <a
              href={`https://solscan.io/tx/${txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-[#7a9ab0] hover:text-[#2e3d47] transition-colors"
            >
              View on Solscan ↗
            </a>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleTrade}
          disabled={isTrading || !quote || !txPending || isOverBalance}
          className={`w-full font-mono text-sm uppercase tracking-widest py-3.5 text-white transition-colors disabled:opacity-40 ${
            side === "long"
              ? "bg-[#3d7a5c] hover:bg-[#4a8a6a]"
              : "bg-[#9b3d3d] hover:bg-[#b04444]"
          }`}
        >
          {btnLabel}
        </button>

        <p className="font-mono text-[9px] text-[#b0aea5] text-center">
          {`Quote refreshes automatically · CPS scored at close · No fees beyond Adrena's`}
        </p>
      </div>
    </div>
  );
}

// ── Close position button ─────────────────────────────────────────────────────

function CloseButton({
  position,
  wallet,
  onClosed,
}: {
  position: OpenPosition;
  wallet: string;
  onClosed: () => void;
}) {
  const { execute } = useTradeTx();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleClose = async () => {
    setError(null);
    try {
      const collateralToken =
        position.side === "short" ? "USDC" : position.symbol;
      const action = position.side === "long" ? "close-long" : "close-short";
      const params = new URLSearchParams({
        action,
        account: wallet,
        collateralTokenSymbol: collateralToken,
        tokenSymbol: position.symbol,
        percentage: "100",
      });
      const r = await fetch(`/api/trade/quote?${params}`);
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "Quote failed");
        return;
      }

      setStatus("signing");
      await execute(d.transaction, (s, detail) => {
        setStatus(s);
        if (s === "confirmed") setTimeout(onClosed, 1500);
        if (s === "error" && detail) setError(detail);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes("reject")) setError(msg);
      setStatus("idle");
    }
  };

  const label =
    status === "quoting"
      ? "Quoting…"
      : status === "signing"
        ? "Check wallet…"
        : status === "sending"
          ? "Sending…"
          : status === "confirmed"
            ? "✓ Closed"
            : "Close";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClose}
        disabled={["quoting", "signing", "sending", "confirmed"].includes(
          status,
        )}
        className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 transition-colors disabled:opacity-40 ${
          status === "confirmed"
            ? "border border-[#3d7a5c] text-[#3d7a5c]"
            : "border border-[#9b3d3d] text-[#9b3d3d] hover:bg-[#9b3d3d] hover:text-white"
        }`}
      >
        {label}
      </button>
      {error && (
        <p className="font-mono text-[9px] text-[#9b3d3d] max-w-[120px] text-right">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Tables ────────────────────────────────────────────────────────────────────

function OpenPositionsTable({
  positions,
  wallet,
  onRefresh,
}: {
  positions: OpenPosition[];
  wallet: string;
  onRefresh: () => void;
}) {
  if (!positions.length)
    return (
      <div className="bg-white border border-[#dddbd5] px-6 py-10 text-center">
        <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
          No open positions this season
        </p>
        <p className="font-mono text-[10px] text-[#b0aea5] mt-1">
          Syncs from Adrena every 60 seconds
        </p>
      </div>
    );
  return (
    <div className="bg-white border border-[#dddbd5] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#2e3d47]">
            {[
              "Market",
              "Side",
              "Size",
              "Entry",
              "Leverage",
              "Open for",
              "",
            ].map((h) => (
              <th
                key={h}
                className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={p.positionId}
              className="border-b border-[#dddbd5] hover:bg-[#f7f6f2] transition-colors"
            >
              <td className="py-3 px-4 font-mono text-xs font-semibold text-[#2e3d47]">
                {p.symbol}-PERP
              </td>
              <td className="py-3 px-4">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ${
                    p.side === "long"
                      ? "bg-[#3d7a5c18] text-[#3d7a5c]"
                      : "bg-[#9b3d3d18] text-[#9b3d3d]"
                  }`}
                >
                  {p.side}
                </span>
              </td>
              <td className="py-3 px-4 font-mono text-xs">
                {fmtUsd(p.entrySize)}
              </td>
              <td className="py-3 px-4 font-mono text-xs text-[#8a8880]">
                {p.entryPrice ? `$${p.entryPrice.toLocaleString()}` : "—"}
              </td>
              <td className="py-3 px-4 font-mono text-xs text-[#8a8880]">
                {p.entryLeverage ? `${p.entryLeverage}×` : "—"}
              </td>
              <td className="py-3 px-4 font-mono text-xs text-[#8a8880]">
                {fmtDuration(p.entryDate)}
              </td>
              <td className="py-3 px-4">
                <CloseButton
                  position={p}
                  wallet={wallet}
                  onClosed={onRefresh}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentClosedTable({ positions }: { positions: ClosedPosition[] }) {
  if (!positions.length)
    return (
      <div className="bg-white border border-[#dddbd5] px-6 py-10 text-center">
        <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
          No closed positions this season yet
        </p>
      </div>
    );
  return (
    <div className="bg-white border border-[#dddbd5] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-[#2e3d47]">
            {["Market", "Side", "PnL", "Duration", "CPS Earned"].map((h) => (
              <th
                key={h}
                className="py-2.5 px-4 text-left font-mono text-[10px] uppercase tracking-widest text-[#8a8880]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const isWin = (p.pnl ?? 0) > 0;
            return (
              <tr
                key={p.positionId}
                className="border-b border-[#dddbd5] hover:bg-[#f7f6f2] transition-colors"
              >
                <td className="py-3 px-4 font-mono text-xs font-semibold text-[#2e3d47]">
                  {p.symbol}-PERP
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-mono text-[10px] uppercase px-2 py-0.5 ${
                      p.side === "long"
                        ? "bg-[#3d7a5c18] text-[#3d7a5c]"
                        : "bg-[#9b3d3d18] text-[#9b3d3d]"
                    }`}
                  >
                    {p.side}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-mono text-xs font-semibold ${isWin ? "text-[#3d7a5c]" : "text-[#9b3d3d]"}`}
                  >
                    {(p.pnl ?? 0) >= 0 ? "+" : ""}
                    {fmtUsd(p.pnl)}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-[#8a8880]">
                  {fmtDuration(p.entryDate, p.exitDate)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-display font-bold text-base ${(p.cpsEarned ?? 0) >= 0 ? "text-[#2e3d47]" : "text-[#9b3d3d]"}`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {p.cpsEarned !== null
                      ? `${(p.cpsEarned ?? 0) >= 0 ? "+" : ""}${fmtCps(p.cpsEarned)}`
                      : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TradeClient() {
  const { wallet, status } = useAuth();
  const [data, setData] = useState<TradePageData | null>(null);
  const [activeMarket, setActiveMarket] = useState("SOL");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const walletRef = useRef(wallet);
  const runRef = useRef<() => void>(() => {});

  walletRef.current = wallet;

  runRef.current = () => {
    const url = walletRef.current
      ? `/api/trade?wallet=${walletRef.current}`
      : "/api/trade";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .catch(() => {});
  };

  useEffect(() => {
    runRef.current();
    intervalRef.current = setInterval(() => runRef.current(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    runRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  const isGauntlet = data?.isGauntlet ?? false;

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      {/* Nav */}
      <nav className="bg-white border-b border-[#dddbd5] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="font-display font-black text-lg tracking-tight text-[#2e3d47]"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              ARENA
            </span>
            <span className="w-px h-4 bg-[#dddbd5]" />
          </Link>
          <span
            className="font-display font-bold text-lg text-[#2e3d47]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            TRADE
          </span>
        </div>
        <div className="flex items-center gap-4">
          {data?.season && (
            <span className="hidden sm:block font-mono text-[10px] text-[#8a8880] uppercase tracking-widest">
              {data.season.name} · Day {data.seasonDay}
              {isGauntlet && (
                <span className="ml-2 text-[#c8a96e]">⚡ Gauntlet</span>
              )}
            </span>
          )}
          <ConnectButton />
        </div>
      </nav>

      {/* Gauntlet banner */}
      {isGauntlet && (
        <div className="bg-[#2e3d47] px-6 py-2.5 flex items-center justify-center gap-3">
          <span>⚡</span>
          <span className="font-mono text-xs text-[#c8a96e] uppercase tracking-widest">
            Gauntlet active — all CPS ×1.5 until Day 10
          </span>
          <span>⚡</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Top row: Chart + Trade form */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:items-stretch">
          {/* Chart column */}
          <div className="flex flex-col">
            <SectionLabel>{activeMarket}-PERP · Price Chart</SectionLabel>
            <div className="flex-1">
              <TradingChart symbol={activeMarket} />
            </div>
          </div>

          {/* Trade form column */}
          <div className="space-y-4">
            <SectionLabel>Open Position</SectionLabel>
            {status === "authenticated" && wallet ? (
              <TradeForm
                wallet={wallet}
                isGauntlet={isGauntlet}
                onMarketChange={setActiveMarket}
                openPositions={data?.openPositions ?? []}
              />
            ) : (
              <div className="bg-[#2e3d47] p-8 flex flex-col items-center gap-4 text-center">
                <p
                  className="font-display font-black text-2xl text-white"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Connect to trade
                </p>
                <p className="font-mono text-xs text-[#8a9aaa]">
                  Sign in to open and close positions directly from Arena
                </p>
                <ConnectButton />
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <SectionLabel
              right={data ? `${data.openPositions.length} open` : undefined}
            >
              Open Positions
            </SectionLabel>
            {wallet ? (
              <>
                <OpenPositionsTable
                  positions={data?.openPositions ?? []}
                  wallet={wallet}
                  onRefresh={() => runRef.current()}
                />
                <p className="font-mono text-[9px] text-[#b0aea5] mt-2">
                  Auto-refreshes every 60s · Close button sends transaction to
                  Solana
                </p>
              </>
            ) : (
              <div className="bg-white border border-[#dddbd5] px-5 py-8 text-center">
                <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                  Connect wallet to see positions
                </p>
              </div>
            )}
          </section>
          <section>
            <SectionLabel
              right={data ? `last ${data.recentClosed.length}` : undefined}
            >
              Recent Closed — CPS Earned
            </SectionLabel>
            {wallet ? (
              <RecentClosedTable positions={data?.recentClosed ?? []} />
            ) : (
              <div className="bg-white border border-[#dddbd5] px-5 py-8 text-center">
                <p className="font-mono text-xs text-[#b0aea5] uppercase tracking-widest">
                  Connect wallet to see history
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
