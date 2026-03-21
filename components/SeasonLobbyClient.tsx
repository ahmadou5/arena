// src/components/SeasonLobbyClient.tsx
"use client";
import { useAuth } from "@/providers/AuthProvider";
import ConnectButton from "./ConnectButton";
import MyStatsCard from "./MyStatsCard";
import SquadPanel from "./SquadPanel";

interface SeasonLobbyClientProps {
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
}: SeasonLobbyClientProps) {
  const { wallet, token } = useAuth();

  return (
    <>
      {/* My Stats Card — shows connect prompt when wallet=null */}
      <MyStatsCard wallet={wallet} seasonNumber={seasonNumber} />

      {/* Squad Panel — floating slide-over */}
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

// Separate named export just for the nav button — imported directly in page nav slot
export function NavConnectButton() {
  return <ConnectButton />;
}
