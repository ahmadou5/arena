import { prisma } from "@/lib/prisma";

async function main() {
  await prisma.season.upsert({
    where: { seasonNumber: 1 },
    update: {},
    create: {
      seasonNumber: 1,
      name: "Arena Season 1",
      startTs: new Date(),
      endTs: new Date(Date.now() + 28 * 86400000),
      offseasonEndTs: new Date(Date.now() + 35 * 86400000),
      isActive: true,
      prizePoolUsdc: 10000,
    },
  });

  for (const wallet of [
    "Test1111111111111111111111111111111111111111",
    "Test2222222222222222222222222222222222222222",
    "Test3333333333333333333333333333333333333333",
  ]) {
    await prisma.trader.upsert({
      where: { wallet },
      update: {},
      create: {
        wallet,
        arenaRating: 400,
        currentDivision: 5,
        registeredSeason: 1,
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
