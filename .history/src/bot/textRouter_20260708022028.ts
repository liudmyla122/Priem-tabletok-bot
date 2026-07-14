import type { MyContext } from "./instance";
import { askElderHasTelegram } from "./commands/addElder";
import { finalizeElderWithoutTelegram } from "./callbacks/elderFlow";
import { linkExistingElderByTelegramUsername } from "../services/userService";
import {
  handleMedNameInput,
  handleMedDosageInput,
  handleMedTimeInput,
} from "./callbacks/medicationFlow";
import {
  handleApptTitleInput,
  handleApptDatetimeInput,
  handleApptLocationInput,
} from "./callbacks/appointmentFlow";
import { prisma } from "../db/client";

/** Роутит свободный текст в зависимости от текущего шага многошагового диалога */
export async function routeTextMessage(ctx: MyContext) {
  const text = ctx.message?.text;
  if (!text) return;

  switch (ctx.session.step) {
    case "awaiting_elder_name":
      ctx.session.draftElder.name = text.trim();
      ctx.session.step = "idle";
      await askElderHasTelegram(ctx);
      return;

    case "awaiting_elder_phone":
      if (ctx.session.draftElder.hasTelegram) {
        // В этом случае в поле пришёл Telegram ID пожилого пользователя
        if (!ctx.from) return;
        const childUser = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
        if (!childUser) return;
        try {
          const elder = await linkExistingElderByTelegramUsername({
            childUserId: childUser.id,
            elderTelegramId: text.trim(),
          });
          ctx.session.step = "idle";
          ctx.session.draftElder = {};
          await ctx.reply(
            `✅ Связал с ${elder.name}. Теперь можешь добавить лекарство командой /add_medication`
          );
        } catch {
          await ctx.reply(
            "Не нашёл пользователя с таким Telegram ID. Убедись, что этот человек уже отправил /start этому боту, и попробуй снова."
          );
        }
      } else {
        // Здесь пришёл номер телефона
        const phone = text.trim();
        if (!/^\+\d{8,15}$/.test(phone)) {
          await ctx.reply("Номер должен быть в формате +491234567890. Попробуй ещё раз.");
          return;
        }
        await finalizeElderWithoutTelegram(ctx, phone);
      }
      return;

    case "awaiting_med_name":
      await handleMedNameInput(ctx, text);
      return;
    case "awaiting_med_dosage":
      await handleMedDosageInput(ctx, text);
      return;
    case "awaiting_med_time":
      await handleMedTimeInput(ctx, text);
      return;

    case "awaiting_appt_title":
      await handleApptTitleInput(ctx, text);
      return;
    case "awaiting_appt_datetime":
      await handleApptDatetimeInput(ctx, text);
      return;
    case "awaiting_appt_location":
      await handleApptLocationInput(ctx, text);
      return;

    default:
      // Свободный текст вне сценария — просто подсказка
      await ctx.reply("Не понял команду. Используй /help, чтобы увидеть список доступных команд.");
      return;
  }
}
