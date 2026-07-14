import type { MyContext } from "../instance";
import { prisma } from "../../db/client";
import { checkAccess, getRemainingTrialDays } from "../../services/subscriptionService";
import { sendSubscriptionInvoice } from "../../services/paymentService";
import { config } from "../../config";

export async function subscribeCommand(ctx: MyContext) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply("Сначала выполни /start");
    return;
  }

  if (!config.telegramPayments.enabled) {
    await ctx.reply(
      "Оплата пока не подключена администратором бота (не задан TELEGRAM_LIQPAY_PROVIDER_TOKEN в .env)."
    );
    return;
  }

  try {
    await sendSubscriptionInvoice({ telegramId: String(ctx.from.id) });
  } catch (err) {
    console.error(err);
    await ctx.reply("Не удалось выставить счёт на оплату. Попробуй позже.");
  }
}

export async function statusCommand(ctx: MyContext) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply("Сначала выполни /start");
    return;
  }

  const access = await checkAccess(user.id);
  const trialDays = await getRemainingTrialDays(user.id);

  if (access.reason === "TRIAL_ACTIVE") {
    await ctx.reply(`🎁 У тебя активен пробный период. Осталось дней: <b>${trialDays}</b>`, {
      parse_mode: "HTML",
    });
  } else if (access.reason === "SUBSCRIPTION_ACTIVE") {
    await ctx.reply("✅ У тебя активна платная подписка.");
  } else if (access.reason === "TRIAL_EXPIRED") {
    await ctx.reply(
      "⛔ Пробный период закончился. Оформи подписку командой /subscribe, чтобы продолжить пользоваться ботом."
    );
  } else if (access.reason === "PAST_DUE") {
    await ctx.reply("⚠️ Подписка истекла. Оформи заново через /subscribe.");
  } else {
    await ctx.reply("У тебя нет активной подписки. Используй /subscribe.");
  }
}
