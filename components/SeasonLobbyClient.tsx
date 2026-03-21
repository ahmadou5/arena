// src/components/SeasonLobbyClient.tsx
// Client shell that reads auth context and passes wallet/token to interactive components
"use client";
import { useAuth } from "@/providers/AuthProvider";
import ConnectButton from "@/components/ConnectButton";
import MyStatsCard from "@/components/MyStatsCard";
import SquadPanel from "@/components/SquadPanel";

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
  seasonName,
}: SeasonLobbyClientProps) {
  const { wallet, token, isConnected } = useAuth();

  return (
    <>
      {/* Connect button — replaces the static placeholder in the nav */}
      <div id="connect-wallet-slot">
        <ConnectButton />
      </div>

      {/* My Stats Card — only renders meaningful content when connected */}
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
