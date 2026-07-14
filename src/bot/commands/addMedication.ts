import type { MyContext } from "../instance";
import { InlineKeyboard } from "../instance";
import { prisma } from "../../db/client";
import { getEldersForChild } from "../../services/userService";

export async function addMedicationCommand(ctx: MyContext) {
  if (!ctx.from) return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(ctx.from.id) } });
  if (!user) {
    await ctx.reply("Сначала выполни /start");
    return;
  }

  const elders = await getEldersForChild(user.id);
  const keyboard = new InlineKeyboard();

  // Можно добавить лекарство самому себе
  keyboard.text("Себе", `med_for_${user.id}`).row();
  for (const elder of elders) {
    keyboard.text(elder.name, `med_for_${elder.id}`).row();
  }

  if (elders.length === 0) {
    await ctx.reply(
      "Для кого добавить напоминание о лекарстве?",
      { reply_markup: new InlineKeyboard().text("Себе", `med_for_${user.id}`) }
    );
    return;
  }

  await ctx.reply("Для кого добавить напоминание о лекарстве?", { reply_markup: keyboard });
}
