import type { MyContext } from "../instance";
import { activateSubscriptionAfterPayment } from "../../services/paymentService";

/** Telegram спрашивает подтверждение перед списанием денег — нужно ответить в течение 10 секунд */
export async function handlePreCheckoutQuery(ctx: MyContext) {
  // Здесь можно добавить дополнительные проверки (например, что payload не подделан)
  await ctx.answerPreCheckoutQuery(true);
}

/** Приходит сразу после успешной оплаты */
export async function handleSuccessfulPayment(ctx: MyContext) {
  if (!ctx.from || !ctx.message?.successful_payment) return;

  const payment = ctx.message.successful_payment;
  await activateSubscriptionAfterPayment({
    telegramId: String(ctx.from.id),
    telegramChargeId: payment.telegram_payment_charge_id,
  });

  await ctx.reply(
    "✅ Оплата прошла успешно! Подписка активна ещё на 1 месяц. Спасибо, что пользуешься ботом 💊"
  );
}
