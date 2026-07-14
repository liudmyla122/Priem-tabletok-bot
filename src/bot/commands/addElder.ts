import type { MyContext } from "../instance";
import { InlineKeyboard } from "../instance";

export async function addElderCommand(ctx: MyContext) {
  ctx.session.step = "awaiting_elder_name";
  ctx.session.draftElder = {};

  await ctx.reply(
    "Как зовут человека, за которым нужно следить? (например: мама Ирина)"
  );
}

export async function askElderHasTelegram(ctx: MyContext) {
  const keyboard = new InlineKeyboard()
    .text("У него есть Telegram", "elder_has_telegram_yes")
    .row()
    .text("Telegram нет, только телефон", "elder_has_telegram_no");

  await ctx.reply("У этого человека есть Telegram?", { reply_markup: keyboard });
}
