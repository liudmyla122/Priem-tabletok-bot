import { Bot, Context, InlineKeyboard, session, SessionFlavor } from "grammy";
import { config } from "../config";
import type { SessionData } from "./session";
import { initialSession } from "./session";

export type MyContext = Context & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>(config.botToken);

bot.use(
  session<SessionData, MyContext>({
    initial: initialSession,
  })
);

export { InlineKeyboard };
