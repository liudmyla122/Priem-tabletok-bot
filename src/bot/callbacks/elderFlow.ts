import type { MyContext } from "../instance";
import { prisma } from "../../db/client";
import { createElderWithoutTelegram } from "../../services/userService";

export async function handleElderHasTelegramYes(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_elder_has_telegram";
  ctx.session.draftElder.hasTelegram = true;
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    "Хорошо! Попроси этого человека:\n" +
      "1) Открыть этого же бота\n" +
      "2) Отправить команду /start\n" +
      "3) Прислать тебе свой Telegram ID (бот покажет его в приветствии) или переслать тебе любое сообщение от бота\n\n" +
      "Когда узнаешь его Telegram ID — пришли мне его числом."
  );
  ctx.session.step = "awaiting_elder_phone"; // переиспользуем шаг для ввода telegramId
}

export async function handleElderHasTelegramNo(ctx: MyContext) {
  await ctx.answerCallbackQuery();
  ctx.session.draftElder.hasTelegram = false;
  ctx.session.step = "awaiting_elder_phone";
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply(
    "Хорошо, укажи номер телефона этого человека в международном формате, например +491234567890.\n" +
      "Напоминания будут приходить ему по SMS."
  );
}

/** Финализирует создание подопечного без Telegram, когда получен телефон */
export async function finalizeElderWithoutTelegram(ctx: MyContext, phone: string) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) return;

  const name = ctx.session.draftElder.name || "Родитель";
  await createElderWithoutTelegram({ childUserId: user.id, name, phone });

  ctx.session.step = "idle";
  ctx.session.draftElder = {};
  await ctx.reply(
    `✅ Добавил ${name} (по SMS). Теперь можешь добавить лекарство командой /add_medication`
  );
}
