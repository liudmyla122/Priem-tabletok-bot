import { bot } from "../bot/instance";
import { config } from "../config";
import { prisma } from "../db/client";
import { SubscriptionStatus } from "@prisma/client";
import { scheduleBillingReminder } from "../scheduler/queues";

/**
 * Отправляет нативный Telegram-инвойс (кнопка "Оплатить" прямо в чате).
 * provider_token берётся из @BotFather после подключения LiqPay — см. README.
 * Используется api.raw.sendInvoice, чтобы не зависеть от позиционной сигнатуры
 * конкретной версии grammY — этот вызов один в один соответствует Bot API.
 */
export async function sendSubscriptionInvoice(params: {
  telegramId: string;
  description?: string;
}): Promise<void> {
  if (!config.telegramPayments.enabled) {
    throw new Error(
      "Оплата не настроена: отсутствует TELEGRAM_LIQPAY_PROVIDER_TOKEN в .env"
    );
  }

  const amountMinorUnits = Math.round(config.subscriptionPriceEur * 100); // центы

  await bot.api.raw.sendInvoice({
    chat_id: Number(params.telegramId),
    title: "Подписка Med Reminder Bot",
    description:
      params.description ||
      `Ежемесячная подписка на напоминания о лекарствах и визитах к врачу — ${config.subscriptionPriceEur}${
        config.subscriptionCurrency === "EUR" ? "€" : " " + config.subscriptionCurrency
      }/мес`,
    payload: `subscription_${params.telegramId}_${Date.now()}`,
    provider_token: config.telegramPayments.liqpayProviderToken,
    currency: config.subscriptionCurrency,
    prices: [
      {
        label: "Подписка на 1 месяц",
        amount: amountMinorUnits,
      },
    ],
  });
}

/** Вызывается при получении successful_payment — активирует/продлевает подписку на месяц */
export async function activateSubscriptionAfterPayment(params: {
  telegramId: string;
  telegramChargeId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { telegramId: params.telegramId } });
  if (!user) return;

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const nextPeriodEnd = new Date();
  nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  // [DEBUG] продление считается от now, а не от currentPeriodEnd -> потеря оставшегося оплаченного времени
  console.log(
    `[DEBUG activateSubscriptionAfterPayment] existing currentPeriodEnd=${existing?.currentPeriodEnd?.toISOString() ?? "нет"}; nextPeriodEnd=${nextPeriodEnd.toISOString()} (считается от now, а не от currentPeriodEnd)`
  );

  await prisma.subscription.update({
    where: { userId: user.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: nextPeriodEnd,
      lastTelegramChargeId: params.telegramChargeId,
      renewalReminderSent: false,
    },
  });

  const reminderDate = new Date(nextPeriodEnd);
  reminderDate.setDate(reminderDate.getDate() - config.billingReminderDaysBefore);
  await scheduleBillingReminder(user.id, reminderDate);
}

/** Вызывается воркером по расписанию: напоминает о необходимости продлить подписку и присылает новый инвойс */
export async function sendRenewalReminder(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!subscription || !subscription.user.telegramId) return;

  // Если уже кто-то оплатил в промежутке (currentPeriodEnd обновился на будущее дальше, чем это напоминание) — пропускаем
  if (subscription.renewalReminderSent) return;

  if (subscription.status === SubscriptionStatus.TRIALING) {
    await bot.api.sendMessage(
      subscription.user.telegramId,
      `⏳ Твой бесплатный пробный период скоро заканчивается. Чтобы не потерять напоминания, оформи подписку:`
    );
    if (config.telegramPayments.enabled) {
      await sendSubscriptionInvoice({ telegramId: subscription.user.telegramId });
    }
    await prisma.subscription.update({ where: { userId }, data: { renewalReminderSent: true } });
    return;
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE) return;

  await bot.api.sendMessage(
    subscription.user.telegramId,
    `⏳ Подписка на Med Reminder Bot скоро закончится. Чтобы не потерять напоминания, оплати следующий месяц:`
  );
  await sendSubscriptionInvoice({ telegramId: subscription.user.telegramId });

  await prisma.subscription.update({
    where: { userId },
    data: { renewalReminderSent: true },
  });
}
