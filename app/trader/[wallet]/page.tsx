// src/app/trader/[wallet]/page.tsx
import type { Metadata } from "next";
import TraderClient from "./TraderClient";

// In Next.js 14 on Vercel, params must be typed as a Promise and awaited.
// Not doing this causes params.wallet to be undefined at runtime.
type PageProps = {
  params: Promise<{ wallet: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { wallet } = await params;
  return {
    title: `${wallet.slice(0, 6)}…${wallet.slice(-4)} · Arena Protocol`,
    description: `Trader profile for ${wallet}`,
  };
}

export default async function TraderPage({ params }: PageProps) {
  const { wallet } = await params;
  return <TraderClient wallet={wallet} />;
}
