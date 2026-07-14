import { Queue } from 'bullmq'
import { redisConnection } from './redis'
import { QUEUE_NAMES } from '../types/jobs'
import { timeToCron } from '../services/timeUtils'

// Очередь: срабатывание расписания лекарства (повторяющаяся, по cron)
export const medicationQueue = new Queue(QUEUE_NAMES.MEDICATION_TRIGGER, {
  connection: redisConnection,
})

// Очередь: срабатывание напоминания о термине/визите (одноразовая, по конкретной дате)
export const appointmentQueue = new Queue(QUEUE_NAMES.APPOINTMENT_TRIGGER, {
  connection: redisConnection,
})

// Очередь: проверка подтверждения + эскалация ("ругаться", если не нажали кнопку)
export const confirmationQueue = new Queue(QUEUE_NAMES.CHECK_CONFIRMATION, {
  connection: redisConnection,
})

// Очередь: напоминание о необходимости оплатить/продлить подписку
export const billingQueue = new Queue(QUEUE_NAMES.BILLING_REMINDER, {
  connection: redisConnection,
})
export async function scheduleMedicationJob(
  medicationId: string,
  timesStr: string,
  timezone: string
) {
  // Для каждого времени создаём отдельную повторяющуюся задачу,
  // чтобы напоминания с разными минутами (напр. 09:00 и 21:30) не терялись.
  const times = timesStr
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  for (let i = 0; i < times.length; i++) {
    const cron = timeToCron(times[i])
    await medicationQueue.add(
      'trigger',
      { medicationId },
      {
        repeat: { pattern: cron, tz: timezone },
        jobId: `med-${medicationId}-${i}`,
      }
    )
  }
}

/** Удаляет все повторяющиеся задания для лекарства (по одной на каждое время). */
export async function removeMedicationJob(medicationId: string) {
  const prefix = `med-${medicationId}`
  const repeatableJobs = await medicationQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.id === prefix || job.id?.startsWith(`${prefix}-`)) {
      await medicationQueue.removeRepeatableByKey(job.key)
    }
  }
}

/** Регистрирует одноразовое напоминание о термине за N минут до события */
export async function scheduleAppointmentJob(
  appointmentId: string,
  remindAt: Date
) {
  const delay = Math.max(0, remindAt.getTime() - Date.now())
  await appointmentQueue.add(
    'trigger',
    { appointmentId },
    { delay, jobId: `appt-${appointmentId}` }
  )
}

/** Ставит проверку подтверждения через delayMinutes после отправки напоминания */
export async function scheduleConfirmationCheck(
  reminderEventId: string,
  delayMinutes: number
) {
  await confirmationQueue.add(
    'check',
    { reminderEventId },
    {
      delay: delayMinutes * 60 * 1000,
      jobId: `check-${reminderEventId}-${Date.now()}`,
    }
  )
}

/** Планирует напоминание об оплате/продлении подписки на конкретную дату */
export async function scheduleBillingReminder(userId: string, remindAt: Date) {
  const delay = Math.max(0, remindAt.getTime() - Date.now())
  await billingQueue.add(
    'remind',
    { userId },
    { delay, jobId: `billing-${userId}-${remindAt.getTime()}` }
  )
}
