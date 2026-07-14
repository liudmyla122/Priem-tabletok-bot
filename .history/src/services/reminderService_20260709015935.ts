import { prisma } from "../db/client";
import { ReminderType, ContactChannel } from "@prisma/client";
import { DateTime } from "luxon";
import {
  sendMedicationReminderToTelegram,
  sendAppointmentReminderToTelegram,
  sendEscalationReminder,
  notifyChildAboutStatus,
} from "./notificationService";
import { sendReminderSms, buildMedicationSmsText, buildAppointmentSmsText } from "./smsService";
import { scheduleConfirmationCheck } from "../scheduler/queues";
import { getChildrenForElder } from "./userService";

const CONFIRMATION_CHECK_DELAY_MIN = 15; // через сколько минут проверяем подтверждение
const MAX_ESCALATIONS = 3;
const ESCALATION_INTERVAL_MIN = 10;

/** Срабатывает по cron-расписанию лекарства: создаёт событие и отправляет напоминание */
export async function triggerMedicationReminder(medicationId: string) {
  const med = await prisma.medication.findUnique({
    where: { id: medicationId },
    include: { elder: true },
  });
  if (!med || !med.active) return;

  const event = await prisma.reminderEvent.create({
    data: {
      type: ReminderType.MEDICATION,
      medicationId: med.id,
      scheduledFor: new Date(),
    },
  });

  await deliverMedicationReminder(event.id);
  await scheduleConfirmationCheck(event.id, CONFIRMATION_CHECK_DELAY_MIN);
}

/** Срабатывает за N минут до термина: создаёт событие и отправляет напоминание */
export async function triggerAppointmentReminder(appointmentId: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { elder: true },
  });
  if (!appt || !appt.active) return;

  const event = await prisma.reminderEvent.create({
    data: {
      type: ReminderType.APPOINTMENT,
      appointmentId: appt.id,
      scheduledFor: appt.dateTime,
    },
  });

  await deliverAppointmentReminder(event.id);
  await scheduleConfirmationCheck(event.id, CONFIRMATION_CHECK_DELAY_MIN);
}

async function deliverMedicationReminder(reminderEventId: string) {
  const event = await prisma.reminderEvent.findUniqueOrThrow({
    where: { id: reminderEventId },
    include: { medication: { include: { elder: true } } },
  });
  const med = event.medication!;
  const elder = med.elder;

  if (elder.channel === ContactChannel.TELEGRAM && elder.telegramId) {
    await sendMedicationReminderToTelegram({
      telegramId: elder.telegramId,
      medName: med.name,
      dosage: med.dosage,
      reminderEventId: event.id,
    });
  } else if (elder.phone) {
    await sendReminderSms(elder.phone, buildMedicationSmsText(med.name, med.dosage ?? undefined));
  }

  await prisma.reminderEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } });
}

async function deliverAppointmentReminder(reminderEventId: string) {
  const event = await prisma.reminderEvent.findUniqueOrThrow({
    where: { id: reminderEventId },
    include: { appointment: { include: { elder: true } } },
  });
  const appt = event.appointment!;
  const elder = appt.elder;
  const whenText = DateTime.fromJSDate(appt.dateTime)
    .setZone(elder.timezone)
    .setLocale("ru")
    .toFormat("d MMMM в HH:mm");

  if (elder.channel === ContactChannel.TELEGRAM && elder.telegramId) {
    await sendAppointmentReminderToTelegram({
      telegramId: elder.telegramId,
      title: appt.title,
      location: appt.location,
      whenText,
      reminderEventId: event.id,
    });
  } else if (elder.phone) {
    await sendReminderSms(elder.phone, buildAppointmentSmsText(appt.title, whenText));
  }

  await prisma.reminderEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } });
}

/** Находит последнее неподтверждённое напоминание для пользователя по номеру телефона и подтверждает его.
 * Используется, когда пожилой родитель отвечает на SMS словом "ПРИНЯЛ"/"ИДУ". */
export async function confirmLatestPendingReminderByPhone(phone: string): Promise<boolean> {
  const elder = await prisma.user.findUnique({ where: { phone } });
  if (!elder) return false;

  const pending = await prisma.reminderEvent.findFirst({
    where: {
      confirmedAt: null,
      OR: [
        { medication: { elderId: elder.id } },
        { appointment: { elderId: elder.id } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) return false;

  await confirmReminderEvent(pending.id);
  return true;
}

/** Вызывается при нажатии кнопки в Telegram ИЛИ при ответном SMS "ПРИНЯЛ"/"ИДУ" */

export async function confirmReminderEvent(reminderEventId: string): Promise<void> {
  const event = await prisma.reminderEvent.update({
    where: { id: reminderEventId },
    data: { confirmedAt: new Date() },
    include: {
      medication: { include: { elder: true } },
      appointment: { include: { elder: true } },
    },
  });

  const elder = event.medication?.elder ?? event.appointment?.elder;
  if (!elder) return;

  const itemLabel = event.medication ? `лекарство "${event.medication.name}"` : `визит "${event.appointment?.title}"`;

  const children = await getChildrenForElder(elder.id);
  for (const child of children) {
    if (child.telegramId) {
      await notifyChildAboutStatus({
        childTelegramId: child.telegramId,
        elderName: elder.name,
        itemLabel,
        confirmed: true,
      });
    }
  }
}

/** Проверяет, было ли подтверждение; если нет — эскалирует (более настойчивое сообщение + уведомление ребёнку) */
export async function checkAndEscalateReminder(reminderEventId: string): Promise<void> {
  const event = await prisma.reminderEvent.findUnique({
    where: { id: reminderEventId },
    include: {
      medication: { include: { elder: true } },
      appointment: { include: { elder: true } },
    },
  });
  if (!event || event.confirmedAt) return; // уже подтверждено — ничего не делаем

  const elder = event.medication?.elder ?? event.appointment?.elder;
  if (!elder) return;

  const newCount = event.escalationCount + 1;
  await prisma.reminderEvent.update({
    where: { id: event.id },
    data: { escalationCount: newCount },
  });

  const itemLabel = event.medication
    ? `Лекарство "${event.medication.name}" ещё не принято!`
    : `Визит "${event.appointment?.title}" ещё не подтверждён!`;

  const callbackData = event.medication
    ? `confirm_med_${event.id}`
    : `confirm_appt_${event.id}`;
  const buttonText = event.medication ? "✅ Я принял(а) лекарство" : "✅ Подтверждаю, иду";

  // Повторное настойчивое сообщение самому пожилому пользователю
  if (elder.channel === ContactChannel.TELEGRAM && elder.telegramId) {
    await sendEscalationReminder({
      telegramId: elder.telegramId,
      text: itemLabel,
      callbackData,
      confirmButtonText: buttonText,
    });
  } else if (elder.phone) {
    await sendReminderSms(elder.phone, `Напоминаем ещё раз: ${itemLabel}\nОтветьте цифрой 1, когда сделаете.`);
  }

  // Уведомляем всех детей о пропуске
  const children = await getChildrenForElder(elder.id);
  for (const child of children) {
    if (child.telegramId) {
      await notifyChildAboutStatus({
        childTelegramId: child.telegramId,
        elderName: elder.name,
        itemLabel: event.medication ? `лекарство "${event.medication.name}"` : `визит "${event.appointment?.title}"`,
        confirmed: false,
      });
    }
  }

  // Если лимит эскалаций не достигнут — планируем следующую проверку
  if (newCount < MAX_ESCALATIONS) {
    await scheduleConfirmationCheck(event.id, ESCALATION_INTERVAL_MIN);
  }
}
