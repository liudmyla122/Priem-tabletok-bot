import type { MyContext } from "../instance";
import { prisma } from "../../db/client";
import { isValidTimeFormat } from "../../services/timeUtils";
import { scheduleMedicationJob } from "../../scheduler/queues";

export async function handleMedForSelection(ctx: MyContext) {
  const match = ctx.callbackQuery?.data?.match(/^med_for_(.+)$/);
  if (!match) return;
  const elderId = match[1];

  await ctx.answerCallbackQuery();
  ctx.session.draftMedication = { elderId };
  ctx.session.step = "awaiting_med_name";
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.reply("Как называется лекарство?");
}

export async function handleMedNameInput(ctx: MyContext, text: string) {
  ctx.session.draftMedication.name = text.trim();
  ctx.session.step = "awaiting_med_dosage";
  await ctx.reply('Укажи дозировку (например "1 таблетка" или "500 мг"). Если не важно — напиши "-"');
}

export async function handleMedDosageInput(ctx: MyContext, text: string) {
  ctx.session.draftMedication.dosage = text.trim() === "-" ? undefined : text.trim();
  ctx.session.step = "awaiting_med_time";
  await ctx.reply(
    "Во сколько принимать? Укажи одно или несколько времён через запятую в формате ЧЧ:ММ.\n" +
      "Например: 09:00 или 09:00, 21:00"
  );
}

export async function handleMedTimeInput(ctx: MyContext, text: string) {
  const times = text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const invalid = times.filter((t) => !isValidTimeFormat(t));
  if (invalid.length > 0 || times.length === 0) {
    await ctx.reply("Некорректный формат времени. Пример: 09:00 или 09:00, 21:00. Попробуй ещё раз.");
    return;
  }

  const draft = ctx.session.draftMedication;
  if (!draft.elderId || !draft.name) {
    await ctx.reply("Что-то пошло не так, начни заново командой /add_medication");
    ctx.session.step = "idle";
    return;
  }

  const elder = await prisma.user.findUnique({ where: { id: draft.elderId } });
  if (!elder) {
    await ctx.reply("Подопечный не найден. Начни заново командой /add_medication");
    ctx.session.step = "idle";
    return;
  }

  const cron = timesToCron(times);

  const creator = await prisma.user.findUnique({ where: { telegramId: String(ctx.from!.id) } });
  if (!creator) return;

  const medication = await prisma.medication.create({
    data: {
      elderId: elder.id,
      createdById: creator.id,
      name: draft.name,
      dosage: draft.dosage,
      cronSchedule: cron,
    },
  });

  await scheduleMedicationJob(medication.id, cron, elder.timezone);

  ctx.session.step = "idle";
  ctx.session.draftMedication = {};

  await ctx.reply(
    `✅ Готово! Лекарство "${medication.name}" будет напоминать в: ${times.join(", ")} каждый день для ${elder.name}.`
  );
}
