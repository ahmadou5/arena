// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "@/providers/WalletProvider";
import AuthProvider from "@/providers/AuthProvider";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Arena Protocol — Competitive Trading Seasons on Solana",
  description:
    "Compete in structured trading seasons. Earn CPS. Rise through divisions. Win prizes.",
  openGraph: {
    title: "Arena Protocol",
    description: "Competitive trading seasons on Solana",
    images: ["/banners/arena_twitter_banner.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-[#f7f6f2]">
        <SolanaProvider>
          <AuthProvider>{children}</AuthProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
