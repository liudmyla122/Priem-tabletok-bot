import { PrismaClient } from "@prisma/client";

// Один общий инстанс Prisma на всё приложение (bot + worker + сервер вебхуков)
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function disconnectDb() {
  await prisma.$disconnect();
}
