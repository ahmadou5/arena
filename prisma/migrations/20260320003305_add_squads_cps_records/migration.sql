-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startTs" TIMESTAMP(3) NOT NULL,
    "endTs" TIMESTAMP(3) NOT NULL,
    "offseasonEndTs" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "prizePoolUsdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trader" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "arenaRating" INTEGER NOT NULL DEFAULT 400,
    "currentDivision" INTEGER NOT NULL DEFAULT 5,
    "registeredSeason" INTEGER,
    "totalSeasonsParticipated" INTEGER NOT NULL DEFAULT 0,
    "totalSeasonsMissed" INTEGER NOT NULL DEFAULT 0,
    "lastActiveSeason" INTEGER,
    "currentSquadId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionCache" (
    "id" SERIAL NOT NULL,
    "positionId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entryPrice" DECIMAL(18,6),
    "exitPrice" DECIMAL(18,6),
    "entrySize" DECIMAL(18,6),
    "pnl" DECIMAL(18,6),
    "entryLeverage" DECIMAL(6,2),
    "entryDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "fees" DECIMAL(18,6),
    "collateralAmount" DECIMAL(18,6),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" SERIAL NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "creatorWallet" TEXT NOT NULL,
    "division" INTEGER NOT NULL DEFAULT 5,
    "squadScore" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "disbanded" BOOLEAN NOT NULL DEFAULT false,
    "synergyQuestWeeks" INTEGER NOT NULL DEFAULT 0,
    "synergyStreakPeak" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" SERIAL NOT NULL,
    "squadId" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CpsRecord" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "positionId" INTEGER,
    "rarScore" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "questCps" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "streakBonus" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "consistencyBonus" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalCps" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CpsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonTraderSummary" (
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "totalCps" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "rankInDivision" INTEGER,
    "rankAtDay14" INTEGER,
    "division" INTEGER,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonTraderSummary_pkey" PRIMARY KEY ("wallet","seasonNumber")
);

-- CreateTable
CREATE TABLE "SeasonRecord" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "finalCps" DECIMAL(18,6),
    "finalRank" INTEGER,
    "division" INTEGER,
    "arStart" INTEGER,
    "arEnd" INTEGER,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "relegated" BOOLEAN NOT NULL DEFAULT false,
    "squadId" INTEGER,
    "squadRank" INTEGER,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "wallet" TEXT NOT NULL,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastStreakDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "QuestCompletion" (
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "questId" TEXT NOT NULL,
    "questType" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestCompletion_pkey" PRIMARY KEY ("wallet","seasonNumber","questId")
);

-- CreateTable
CREATE TABLE "PrizeAllocation" (
    "id" SERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "prizeType" TEXT NOT NULL,
    "amountUsdc" DECIMAL(18,6) NOT NULL,
    "rank" INTEGER,
    "squadId" INTEGER,
    "achievementKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nonce" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_seasonNumber_key" ON "Season"("seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Trader_wallet_key" ON "Trader"("wallet");

-- CreateIndex
CREATE INDEX "Trader_arenaRating_idx" ON "Trader"("arenaRating" DESC);

-- CreateIndex
CREATE INDEX "Trader_currentDivision_idx" ON "Trader"("currentDivision");

-- CreateIndex
CREATE UNIQUE INDEX "PositionCache_positionId_key" ON "PositionCache"("positionId");

-- CreateIndex
CREATE INDEX "PositionCache_wallet_seasonNumber_idx" ON "PositionCache"("wallet", "seasonNumber");

-- CreateIndex
CREATE INDEX "PositionCache_status_idx" ON "PositionCache"("status");

-- CreateIndex
CREATE INDEX "Squad_squadScore_idx" ON "Squad"("squadScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Squad_seasonNumber_name_key" ON "Squad"("seasonNumber", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_wallet_key" ON "SquadMember"("squadId", "wallet");

-- CreateIndex
CREATE UNIQUE INDEX "CpsRecord_positionId_key" ON "CpsRecord"("positionId");

-- CreateIndex
CREATE INDEX "CpsRecord_wallet_seasonNumber_idx" ON "CpsRecord"("wallet", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CpsRecord_wallet_seasonNumber_positionId_key" ON "CpsRecord"("wallet", "seasonNumber", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonRecord_wallet_seasonNumber_key" ON "SeasonRecord"("wallet", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_wallet_seasonNumber_achievementKey_key" ON "Achievement"("wallet", "seasonNumber", "achievementKey");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeAllocation_wallet_seasonNumber_prizeType_rank_key" ON "PrizeAllocation"("wallet", "seasonNumber", "prizeType", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Nonce_value_key" ON "Nonce"("value");

-- AddForeignKey
ALTER TABLE "Trader" ADD CONSTRAINT "Trader_currentSquadId_fkey" FOREIGN KEY ("currentSquadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCache" ADD CONSTRAINT "PositionCache_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "Season"("seasonNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "Season"("seasonNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpsRecord" ADD CONSTRAINT "CpsRecord_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpsRecord" ADD CONSTRAINT "CpsRecord_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "Season"("seasonNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CpsRecord" ADD CONSTRAINT "CpsRecord_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "PositionCache"("positionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTraderSummary" ADD CONSTRAINT "SeasonTraderSummary_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonTraderSummary" ADD CONSTRAINT "SeasonTraderSummary_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "Season"("seasonNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonRecord" ADD CONSTRAINT "SeasonRecord_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonRecord" ADD CONSTRAINT "SeasonRecord_seasonNumber_fkey" FOREIGN KEY ("seasonNumber") REFERENCES "Season"("seasonNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonRecord" ADD CONSTRAINT "SeasonRecord_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAllocation" ADD CONSTRAINT "PrizeAllocation_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Trader"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAllocation" ADD CONSTRAINT "PrizeAllocation_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
