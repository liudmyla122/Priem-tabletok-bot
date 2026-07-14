import type { MyContext } from "../instance";
import { prisma } from "../../db/client";
import { DateTime } from "luxon";
import { scheduleAppointmentJob } from "../../scheduler/queues";

export async function handleApptForSelection(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^appt_for_(.+)$/);
  if (!match) return;
  const elderId = match[1];

  await ctx.answerCallbackQuery();
  ctx.session.draftAppointment = { elderId };
  ctx.session.step = "awaiting_appt_title";
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply("Название визита? (например: Приём у кардиолога)");
}

export async function handleApptTitleInput(ctx: MyContext, text: string) {
  ctx.session.draftAppointment.title = text.trim();
  ctx.session.step = "awaiting_appt_datetime";
  await ctx.reply("Дата и время визита в формате ДД.ММ.ГГГГ ЧЧ:ММ, например: 15.07.2026 14:30");
}

export async function handleApptDatetimeInput(ctx: MyContext, text: string) {
  const dt = DateTime.fromFormat(text.trim(), "dd.MM.yyyy HH:mm", { zone: "Europe/Berlin" });
  if (!dt.isValid) {
    await ctx.reply("Не удалось разобрать дату. Формат: ДД.ММ.ГГГГ ЧЧ:ММ, например 15.07.2026 14:30");
    return;
  }
  if (dt.toMillis() <= Date.now()) {
    await ctx.reply("Эта дата уже в прошлом. Укажи будущую дату и время.");
    return;
  }

  ctx.session.draftAppointment.dateTimeRaw = dt.toISO() ?? undefined;
  ctx.session.step = "awaiting_appt_location";
  await ctx.reply('Где проходит визит? (адрес/клиника). Если не важно — напиши "-"');
}

export async function handleApptLocationInput(ctx: MyContext, text: string) {
  const draft = ctx.session.draftAppointment;
  if (!draft.elderId || !draft.title || !draft.dateTimeRaw) {
    await ctx.reply("Что-то пошло не так, начни заново командой /add_appointment");
    ctx.session.step = "idle";
    return;
  }

  const location = text.trim() === "-" ? undefined : text.trim();

  const elder = await prisma.user.findUnique({ where: { id: draft.elderId } });
  const creator = await prisma.user.findUnique({ where: { telegramId: String(ctx.from!.id) } });
  if (!elder || !creator) {
    await ctx.reply("Подопечный не найден. Начни заново командой /add_appointment");
    ctx.session.step = "idle";
    return;
  }

  // [DEBUG] сравнение часового пояса подопечного с жёстко зашитым Europe/Berlin
  console.log(
    `[DEBUG appointmentFlow] elder.timezone=${elder.timezone} (парсинг было в Europe/Berlin); dateTimeRaw=${draft.dateTimeRaw} -> UTC ${new Date(draft.dateTimeRaw).toISOString()}`
  );

  const dateTime = new Date(draft.dateTimeRaw);
  const reminderBeforeMin = 120; // напоминание за 2 часа — можно расширить настройкой позже

  const appointment = await prisma.appointment.create({
    data: {
      elderId: elder.id,
      createdById: creator.id,
      title: draft.title,
      location,
      dateTime,
      reminderBeforeMin,
    },
  });

  const remindAt = new Date(dateTime.getTime() - reminderBeforeMin * 60 * 1000);
  await scheduleAppointmentJob(appointment.id, remindAt);

  ctx.session.step = "idle";
  ctx.session.draftAppointment = {};

  await ctx.reply(
    `✅ Готово! Напоминание о визите "${appointment.title}" придёт за 2 часа для ${elder.name}.`
  );
}
