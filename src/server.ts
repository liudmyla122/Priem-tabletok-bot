import express from "express";
import { isConfirmationText } from "./services/smsService";
import { confirmLatestPendingReminderByPhone } from "./services/reminderService";

/**
 * HTTP-сервер нужен только для вебхука Twilio (входящие SMS-подтверждения от пожилых
 * родителей без Telegram). Оплата подписки теперь идёт через нативные инвойсы Telegram
 * (LiqPay как provider_token) и не требует публичного домена вообще.
 */
export function createServer() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Twilio присылает входящие SMS сюда (нужно настроить в консоли Twilio: Messaging → Webhook)
  app.post("/webhooks/twilio/sms", async (req, res) => {
    const from = req.body.From as string | undefined;
    const body = (req.body.Body as string | undefined) || "";

    // [DEBUG] вебхук не проверяет X-Twilio-Signature -> любой, знающий URL, может подделать подтверждение
    console.log(
      `[DEBUG twilio webhook] From=${from} Body="${body}"; ВНИМАНИЕ: проверка X-Twilio-Signature НЕ выполняется`
    );

    if (from && isConfirmationText(body)) {
      const confirmed = await confirmLatestPendingReminderByPhone(from);
      console.log(`[twilio webhook] SMS от ${from}: "${body}" → подтверждено: ${confirmed}`);
    }

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  return app;
}
