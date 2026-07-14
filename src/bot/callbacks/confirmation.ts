import type { MyContext } from "../instance";
import { confirmReminderEvent } from "../../services/reminderService";

export async function handleConfirmMedication(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^confirm_med_(.+)$/);
  if (!match) return;
  const reminderEventId = match[1];

  await confirmReminderEvent(reminderEventId);
  await ctx.answerCallbackQuery({ text: "Отлично! Записал ✅" });
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.editMessageCaption({ caption: "✅ Приём лекарства подтверждён. Так держать!" }).catch(() => {
    // если сообщение было текстовым (без анимации), правим текст, а не caption
    ctx.editMessageText("✅ Приём лекарства подтверждён. Так держать!").catch(() => {});
  });
}

export async function handleConfirmAppointment(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^confirm_appt_(.+)$/);
  if (!match) return;
  const reminderEventId = match[1];

  await confirmReminderEvent(reminderEventId);
  await ctx.answerCallbackQuery({ text: "Записал, удачи на визите! ✅" });
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.editMessageCaption({ caption: "✅ Визит подтверждён." }).catch(() => {
    ctx.editMessageText("✅ Визит подтверждён.").catch(() => {});
  });
}
