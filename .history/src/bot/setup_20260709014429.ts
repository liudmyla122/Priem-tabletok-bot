import { bot } from "./instance";
import { requireActiveAccess } from "./middleware/accessControl";

import { startCommand, helpCommand } from "./commands/start";
import { addElderCommand } from "./commands/addElder";
import { addMedicationCommand } from "./commands/addMedication";
import { addAppointmentCommand } from "./commands/addAppointment";
import { myEldersCommand } from "./commands/myElders";
import { subscribeCommand, statusCommand } from "./commands/subscribe";

import { handleElderHasTelegramYes, handleElderHasTelegramNo } from "./callbacks/elderFlow";
import { handleMedForSelection } from "./callbacks/medicationFlow";
import { handleApptForSelection } from "./callbacks/appointmentFlow";
import { handleConfirmMedication, handleConfirmAppointment } from "./callbacks/confirmation";
import { handlePreCheckoutQuery, handleSuccessfulPayment } from "./callbacks/payments";

import { routeTextMessage } from "./textRouter";

export function setupBot() {
  bot.use(requireActiveAccess);

  // === Команды ===
  bot.command("start", startCommand);
  bot.command("help", helpCommand);
  bot.command("add_elder", addElderCommand);
  bot.command("add_medication", addMedicationCommand);
  bot.command("add_appointment", addAppointmentCommand);
  bot.command("my_elders", myEldersCommand);
  bot.command("subscribe", subscribeCommand);
  bot.command("status", statusCommand);

  // === Callback-кнопки ===
  bot.callbackQuery("elder_has_telegram_yes", handleElderHasTelegramYes);
  bot.callbackQuery("elder_has_telegram_no", handleElderHasTelegramNo);
  bot.callbackQuery(/^med_for_.+$/, handleMedForSelection);
  bot.callbackQuery(/^appt_for_.+$/, handleApptForSelection);
  bot.callbackQuery(/^confirm_med_.+$/, handleConfirmMedication);
  bot.callbackQuery(/^confirm_appt_.+$/, handleConfirmAppointment);

  // === Оплата подписки ===
  bot.on("pre_checkout_query", handlePreCheckoutQuery);
  bot.on("message:successful_payment", handleSuccessfulPayment);

  // === Свободный текст (многошаговые сценарии) ===
  bot.on("message:text", routeTextMessage);

  bot.catch((err) => {
    console.error("[bot] Необработанная ошибка:", err);
  });

  return bot;
}
