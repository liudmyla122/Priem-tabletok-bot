import type { MyContext } from "../instance";
import { prisma } from "../../db/client";
import { getEldersForChild } from "../../services/userService";

export async function myEldersCommand(ctx: MyContext) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply("Сначала выполни /start");
    return;
  }

  const elders = await getEldersForChild(user.id);
  if (elders.length === 0) {
    await ctx.reply("У тебя пока нет добавленных подопечных. Используй /add_elder, чтобы добавить.");
    return;
  }

  let text = "<b>Твои подопечные:</b>\n\n";
  for (const elder of elders) {
    const meds = await prisma.medication.count({ where: { elderId: elder.id, active: true } });
    const appts = await prisma.appointment.count({
      where: { elderId: elder.id, active: true, dateTime: { gte: new Date() } },
    });
    const channel = elder.channel === "TELEGRAM" ? "Telegram" : "SMS";
    text += `👤 <b>${elder.name}</b> (связь: ${channel})\n` + `   💊 Лекарств: ${meds} | 📅 Предстоящих визитов: ${appts}\n\n`;
  }

  await ctx.reply(text, { parse_mode: "HTML" });
}
