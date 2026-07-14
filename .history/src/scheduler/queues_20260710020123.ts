import { Queue } from "bullmq";
import { redisConnection } from "./redis";
import { QUEUE_NAMES } from "../types/jobs";

// Очередь: срабатывание расписания лекарства (повторяющаяся, по cron)
export const medicationQueue = new Queue(QUEUE_NAMES.MEDICATION_TRIGGER, {
  connection: redisConnection,
});

// Очередь: срабатывание напоминания о термине/визите (одноразовая, по конкретной дате)
export const appointmentQueue = new Queue(QUEUE_NAMES.APPOINTMENT_TRIGGER, {
  connection: redisConnection,
});

// Очередь: проверка подтверждения + эскалация ("ругаться", если не нажали кнопку)
export const confirmationQueue = new Queue(QUEUE_NAMES.CHECK_CONFIRMATION, {
  connection: redisConnection,
});

// Очередь: напоминание о необходимости оплатить/продлить подписку
export const billingQueue = new Queue(QUEUE_NAMES.BILLING_REMINDER, {
  connection: redisConnection,
});
export async function scheduleMedicationJob(medicationId: string, cronSchedule: string, timezone: string) {
  // [DEBUG] задача создана; соответствующая очистка (removeMedicationJob) в коде не вызывается
  console.log(`[DEBUG scheduleMedicationJob] created repeatable job med-${medicationId} cron=${cronSchedule} tz=${timezone}`);
  await medicationQueue.add(
    "trigger",
    { medicationId },
    {
      repeat: { pattern: cronSchedule, tz: timezone },
      jobId: `med-${medicationId}`, // позволяет потом удалить/обновить именно эту задачу
    }
  );
}

/** Удаляет все повторяющиеся задания для лекарства (например, при деактивации) */
export async function removeMedicationJob(medicationId: string, cronSchedule: string, timezone: string) {
  // [DEBUG] если этот лог никогда не появляется — removeMedicationJob не вызывается (мёртвый код), задачи осиротевают
  console.log(`[DEBUG removeMedicationJob] called for med-${medicationId} (cleanup wired?)`);
  const repeatableJobs = await medicationQueue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === `med-${medicationId}`);
  if (job) {
    await medicationQueue.removeRepeatableByKey(job.key);
  }
}

/** Регистрирует одноразовое напоминание о термине за N минут до события */
export async function scheduleAppointmentJob(appointmentId: string, remindAt: Date) {
  const delay = Math.max(0, remindAt.getTime() - Date.now());
  await appointmentQueue.add(
    "trigger",
    { appointmentId },
    { delay, jobId: `appt-${appointmentId}` }
  );
}

/** Ставит проверку подтверждения через delayMinutes после отправки напоминания */
export async function scheduleConfirmationCheck(reminderEventId: string, delayMinutes: number) {
  await confirmationQueue.add(
    "check",
    { reminderEventId },
    { delay: delayMinutes * 60 * 1000, jobId: `check-${reminderEventId}-${Date.now()}` }
  );
}

/** Планирует напоминание об оплате/продлении подписки на конкретную дату */
export async function scheduleBillingReminder(userId: string, remindAt: Date) {
  const delay = Math.max(0, remindAt.getTime() - Date.now());
  await billingQueue.add(
    "remind",
    { userId },
    { delay, jobId: `billing-${userId}-${remindAt.getTime()}` }
  );
}
