// src/app/trade/page.tsx
import type { Metadata } from "next";
import TradeClient from "./TradeClient";

export const metadata: Metadata = {
  title: "Trade — Arena Protocol",
  description: "Open positions, calculate CPS, and trade on Adrena",
};

export default function TradePage() {
  return <TradeClient />;
}
