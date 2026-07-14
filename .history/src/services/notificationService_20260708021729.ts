import { bot, InlineKeyboard } from "../bot/instance";
import path from "path";
import fs from "fs";
import { InputFile } from "grammy";

// Папка с заготовленными анимациями (GIF/MP4). Положи туда свои файлы —
// см. README раздел "Анимации" за рекомендациями по созданию.
const ASSETS_DIR = path.join(__dirname, "..", "assets");

const MED_ANIMATIONS = ["pill-morning.mp4", "pill-day.mp4", "pill-evening.mp4"];
const APPT_ANIMATION = "appointment-reminder.mp4";
const ESCALATION_ANIMATION = "escalation-alert.mp4";

function pickAnimation(files: string[]): string | null {
  const file = files[Math.floor(Math.random() * files.length)];
  const fullPath = path.join(ASSETS_DIR, file);
  return fs.existsSync(fullPath) ? fullPath : null;
}

interface SendReminderParams {
  telegramId: string;
  caption: string;
  confirmButtonText: string;
  callbackData: string;
  animationFile?: string | null;
}

/** Отправляет анимированное напоминание с кнопкой подтверждения. Падает обратно на обычный текст, если анимации ещё не добавлены в /assets */
export async function sendAnimatedReminder(params: SendReminderParams): Promise<number> {
  const keyboard = new InlineKeyboard().text(params.confirmButtonText, params.callbackData);

  if (params.animationFile && fs.existsSync(params.animationFile)) {
    const message = await bot.api.sendAnimation(
      params.telegramId,
      new InputFile(params.animationFile),
      {
        caption: params.caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
    return message.message_id;
  }

  // Фолбэк без видео, пока в /assets нет файлов — бот всё равно полностью рабочий
  const message = await bot.api.sendMessage(params.telegramId, params.caption, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
  return message.message_id;
}

export async function sendMedicationReminderToTelegram(params: {
  telegramId: string;
  medName: string;
  dosage?: string | null;
  reminderEventId: string;
}): Promise<number> {
  const animation = pickAnimation(MED_ANIMATIONS);
  const caption =
    `💊 <b>Пора принять лекарство!</b>\n\n` +
    `Название: <b>${escapeHtml(params.medName)}</b>` +
    (params.dosage ? `\nДозировка: ${escapeHtml(params.dosage)}` : "");

  return sendAnimatedReminder({
    telegramId: params.telegramId,
    caption,
    confirmButtonText: "✅ Я принял(а) лекарство",
    callbackData: `confirm_med_${params.reminderEventId}`,
    animationFile: animation,
  });
}

export async function sendAppointmentReminderToTelegram(params: {
  telegramId: string;
  title: string;
  location?: string | null;
  whenText: string;
  reminderEventId: string;
}): Promise<number> {
  const animation = pickAnimation([APPT_ANIMATION]);
  const caption =
    `📅 <b>Напоминание о визите!</b>\n\n` +
    `${escapeHtml(params.title)}\n` +
    `Когда: ${params.whenText}` +
    (params.location ? `\nГде: ${escapeHtml(params.location)}` : "");

  return sendAnimatedReminder({
    telegramId: params.telegramId,
    caption,
    confirmButtonText: "✅ Подтверждаю, иду",
    callbackData: `confirm_appt_${params.reminderEventId}`,
    animationFile: animation,
  });
}

/** Более настойчивое повторное сообщение, если подтверждения так и не было */
export async function sendEscalationReminder(params: {
  telegramId: string;
  text: string;
  callbackData: string;
  confirmButtonText: string;
}): Promise<void> {
  const animation = pickAnimation([ESCALATION_ANIMATION]);
  const keyboard = new InlineKeyboard().text(params.confirmButtonText, params.callbackData);

  if (animation) {
    await bot.api.sendAnimation(params.telegramId, new InputFile(animation), {
      caption: `⚠️ ${params.text}`,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    await bot.api.sendMessage(params.telegramId, `⚠️ ${params.text}`, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

/** Уведомляет ребёнка (наблюдателя), что родитель подтвердил/пропустил приём */
export async function notifyChildAboutStatus(params: {
  childTelegramId: string;
  elderName: string;
  itemLabel: string;
  confirmed: boolean;
}): Promise<void> {
  const text = params.confirmed
    ? `✅ ${escapeHtml(params.elderName)} подтвердил(а): ${escapeHtml(params.itemLabel)} — вовремя.`
    : `❗️ ${escapeHtml(params.elderName)} <b>ещё не подтвердил(а)</b>: ${escapeHtml(
        params.itemLabel
      )}. Возможно, стоит позвонить и проверить.`;

  await bot.api.sendMessage(params.childTelegramId, text, { parse_mode: "HTML" });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
