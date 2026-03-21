//db-health.ts
import { prisma } from "../lib/prisma";

prisma.$queryRaw`SELECT NOW()`
  .then((r: unknown) => {
    console.log("DB OK:", r);
    prisma.$disconnect();
  })
  .catch((e: unknown) => {
    console.error("DB FAIL:", e);
    process.exit(1);
  });
