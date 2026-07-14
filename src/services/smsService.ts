import twilio from "twilio";
import { config } from "../config";

const client = config.twilio.enabled
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

/** Отправляет обычное SMS-напоминание. Ответ "ПРИНЯЛ" распознаётся через webhook. */
export async function sendReminderSms(toPhone: string, message: string): Promise<void> {
  if (!client) {
    console.warn("[smsService] Twilio не сконфигурирован — SMS не отправлено:", message);
    return;
  }
  await client.messages.create({
    to: toPhone,
    from: config.twilio.phoneNumber,
    body: message,
  });
}

export function buildMedicationSmsText(medName: string, dosage?: string): string {
  return (
    `Пора принять лекарство: ${medName}${dosage ? " (" + dosage + ")" : ""}.\n` +
    `Когда примете — ответьте на это SMS словом ПРИНЯЛ или просто цифрой 1.`
  );
}

export function buildAppointmentSmsText(title: string, whenText: string): string {
  return (
    `Напоминание: у вас "${title}" ${whenText}.\n` +
    `Ответьте словом ИДУ или просто цифрой 1, если подтверждаете визит.`
  );
}

/** Проверяет, является ли текст входящего SMS подтверждением.
 * Список специально широкий и включает однобуквенные/цифровые варианты — так проще
 * ответить людям с моторными или когнитивными затруднениями, не только точным словом. */
export function isConfirmationText(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return [
    "ПРИНЯЛ", "ПРИНЯЛА", "ИДУ", "OK", "ОК", "YES", "ДА",
    "1", "+", "V", "ГОТОВО", "СДЕЛАНО", "✓",
  ].includes(normalized);
}
