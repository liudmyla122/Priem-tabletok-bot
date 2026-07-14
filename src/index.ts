import { bot } from "./bot/instance";
import { setupBot } from "./bot/setup";
import { createServer } from "./server";
import { config } from "./config";

async function main() {
  setupBot();

  // HTTP-сервер нужен только для вебхука Twilio SMS (оплата идёт через нативные Telegram-инвойсы, без веб-хуков)
  const app = createServer();
  app.listen(config.port, () => {
    console.log(`🌐 HTTP-сервер вебхуков запущен на порту ${config.port}`);
  });

  // Бот работает через long polling — не требует публичного домена
  // (публичный домен нужен только для вебхука Twilio SMS, см. README)
  await bot.start({
    onStart: () => console.log("🤖 Telegram-бот запущен (polling)"),
  });
}

main().catch((err) => {
  console.error("Критическая ошибка при запуске:", err);
  process.exit(1);
});
