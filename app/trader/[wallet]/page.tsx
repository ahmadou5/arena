// src/app/trader/[wallet]/page.tsx
import type { Metadata } from "next";
import TraderClient from "./TraderClient";

export async function generateMetadata({
  params,
}: {
  params: { wallet: string };
}): Promise<Metadata> {
  const w = params.wallet;
  return {
    title: `${w.slice(0, 6)}…${w.slice(-4)} · Arena Protocol`,
    description: `Trader profile for ${w}`,
  };
}

export default function TraderPage({ params }: { params: { wallet: string } }) {
  return <TraderClient wallet={params.wallet} />;
}
