import { prisma } from "../db/client";
import { Role, ContactChannel } from "@prisma/client";
import { config } from "../config";
import { scheduleBillingReminder } from "../scheduler/queues";

/** Находит или создаёт пользователя по telegramId (обычный /start) */
export async function findOrCreateTelegramUser(telegramId: string, name: string) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        name,
        role: Role.STANDALONE,
        channel: ContactChannel.TELEGRAM,
      },
    });

    // Даём каждому новому пользователю пробный период
    const trialEndsAt = new Date(Date.now() + config.trialDays * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        userId: user.id,
        trialEndsAt,
        status: "TRIALING",
      },
    });

    // Напоминаем об окончании триала за billingReminderDaysBefore до истечения (только если оплата включена)
    if (config.billingEnabled) {
      const reminderDate = new Date(trialEndsAt);
      reminderDate.setDate(reminderDate.getDate() - config.billingReminderDaysBefore);
      if (reminderDate.getTime() > Date.now()) {
        await scheduleBillingReminder(user.id, reminderDate);
      }
    }
  }
  return user;
}

/** Создаёт пожилого родственника без Telegram (управляется ребёнком) */
export async function createElderWithoutTelegram(params: {
  childUserId: string;
  name: string;
  phone: string;
}) {
  const elder = await prisma.user.create({
    data: {
      name: params.name,
      phone: params.phone,
      role: Role.ELDER,
      channel: ContactChannel.SMS,
    },
  });

  await prisma.familyLink.create({
    data: { childId: params.childUserId, elderId: elder.id },
  });

  return elder;
}

/** Связывает существующего telegram-пользователя (пожилого) как подопечного ребёнка */
export async function linkExistingElderByTelegramUsername(params: {
  childUserId: string;
  elderTelegramId: string;
}) {
  let elder = await prisma.user.findUnique({ where: { telegramId: params.elderTelegramId } });
  if (!elder) {
    throw new Error("ELDER_NOT_FOUND");
  }
  await prisma.user.update({ where: { id: elder.id }, data: { role: Role.ELDER } });
  await prisma.familyLink.upsert({
    where: { childId_elderId: { childId: params.childUserId, elderId: elder.id } },
    update: {},
    create: { childId: params.childUserId, elderId: elder.id },
  });
  return elder;
}

/** Возвращает всех подопечных (родителей) для ребёнка */
export async function getEldersForChild(childUserId: string) {
  const links = await prisma.familyLink.findMany({
    where: { childId: childUserId },
    include: { elder: true },
  });
  return links.map((l) => l.elder);
}

/** Возвращает всех детей, которые следят за конкретным пожилым пользователем */
export async function getChildrenForElder(elderUserId: string) {
  const links = await prisma.familyLink.findMany({
    where: { elderId: elderUserId },
    include: { child: true },
  });
  return links.map((l) => l.child);
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
