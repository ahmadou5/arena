// src/components/SeasonLobbyClient.tsx
"use client";
import { useAuth } from "@/providers/AuthProvider";
import ConnectButton from "@/components/ConnectButton";
import MyStatsCard from "@/components/MyStatsCard";
import SquadPanel from "@/components/SquadPanel";

interface Props {
  seasonNumber: number;
  isSquadLocked: boolean;
  lockDay: number;
  seasonDay: number;
  seasonName: string;
}

export default function SeasonLobbyClient({
  seasonNumber,
  isSquadLocked,
  lockDay,
  seasonDay,
}: Props) {
  const { wallet, token } = useAuth();

  return (
    <>
      <MyStatsCard wallet={wallet} seasonNumber={seasonNumber} />
      <SquadPanel
        seasonNumber={seasonNumber}
        wallet={wallet}
        token={token}
        isSquadLocked={isSquadLocked}
        lockDay={lockDay}
        seasonDay={seasonDay}
      />
    </>
  );
}

// Separate named export — used in the nav by page.tsx
// Both are client components so this is safe to import from a server component
export function NavConnectButton() {
  return <ConnectButton />;
}
