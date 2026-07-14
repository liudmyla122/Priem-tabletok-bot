import type { MyContext } from "../instance";
import { InlineKeyboard } from "../instance";
import { prisma } from "../../db/client";
import { getEldersForChild } from "../../services/userService";

export async function addAppointmentCommand(ctx: MyContext) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply("Сначала выполни /start");
    return;
  }

  const elders = await getEldersForChild(user.id);
  const keyboard = new InlineKeyboard();
  keyboard.text("Себе", `appt_for_${user.id}`).row();
  for (const elder of elders) {
    keyboard.text(elder.name, `appt_for_${elder.id}`).row();
  }

  await ctx.reply("Для кого добавить напоминание о визите?", { reply_markup: keyboard });
}
