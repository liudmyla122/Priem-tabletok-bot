import type { MyContext } from "../instance";
import { NextFunction } from "grammy";
import { prisma } from "../../db/client";
import { checkAccess } from "../../services/subscriptionService";
import { config } from "../../config";

// Команды, доступные без подписки (регистрация, справка, оплата, статус)
const FREE_COMMANDS = ["/start", "/help", "/subscribe", "/status"];

export async function requireActiveAccess(ctx: MyContext, next: NextFunction) {
  // Пока оплата глобально не включена администратором бота — пропускаем всех бесплатно
  if (!config.billingEnabled) {
    return next();
  }

  const text = ctx.message?.text;
  if (text && FREE_COMMANDS.some((c) => text.startsWith(c))) {
    return next();
  }

  // Оплата должна всегда проходить, даже если подписка уже истекла — иначе человек не сможет продлить
  if (ctx.update.pre_checkout_query || ctx.message?.successful_payment) {
    return next();
  }

  // Разрешаем подтверждение через кнопки в любом случае — это ключевая функция для уже созданных напоминаний
  if (ctx.callbackQuery?.data?.startsWith("confirm_")) {
    return next();
  }

  if (!ctx.from) return next();

  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) return next(); // ещё не зарегистрирован — пусть дойдёт до /start

  const access = await checkAccess(user.id);
  if (!access.allowed) {
    await ctx.reply(
      "⛔ Пробный период закончился или подписка неактивна.\n" +
        "Оформи подписку командой /subscribe, чтобы продолжить пользоваться ботом."
    );
    return;
  }

  return next();
}
