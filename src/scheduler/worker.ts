import { Worker } from "bullmq";
import { redisConnection } from "./redis";
import { QUEUE_NAMES } from "../types/jobs";
import type { MedicationTriggerJob, AppointmentTriggerJob, CheckConfirmationJob, BillingReminderJob } from "../types/jobs";
import {
  triggerMedicationReminder,
  triggerAppointmentReminder,
  checkAndEscalateReminder,
} from "../services/reminderService";
import { sendRenewalReminder } from "../services/paymentService";

console.log("🚀 Worker напоминаний запущен, слушаю очереди...");

const medicationWorker = new Worker<MedicationTriggerJob>(
  QUEUE_NAMES.MEDICATION_TRIGGER,
  async (job) => {
    console.log(`[worker] Срабатывание лекарства: ${job.data.medicationId}`);
    await triggerMedicationReminder(job.data.medicationId);
  },
  { connection: redisConnection }
);

const appointmentWorker = new Worker<AppointmentTriggerJob>(
  QUEUE_NAMES.APPOINTMENT_TRIGGER,
  async (job) => {
    console.log(`[worker] Срабатывание термина: ${job.data.appointmentId}`);
    await triggerAppointmentReminder(job.data.appointmentId);
  },
  { connection: redisConnection }
);

const confirmationWorker = new Worker<CheckConfirmationJob>(
  QUEUE_NAMES.CHECK_CONFIRMATION,
  async (job) => {
    console.log(`[worker] Проверка подтверждения: ${job.data.reminderEventId}`);
    await checkAndEscalateReminder(job.data.reminderEventId);
  },
  { connection: redisConnection }
);

const billingWorker = new Worker<BillingReminderJob>(
  QUEUE_NAMES.BILLING_REMINDER,
  async (job) => {
    console.log(`[worker] Напоминание об оплате: ${job.data.userId}`);
    await sendRenewalReminder(job.data.userId);
  },
  { connection: redisConnection }
);

for (const worker of [medicationWorker, appointmentWorker, confirmationWorker, billingWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] Задача ${job?.id} провалилась:`, err);
  });
}

process.on("SIGTERM", async () => {
  await Promise.all([
    medicationWorker.close(),
    appointmentWorker.close(),
    confirmationWorker.close(),
    billingWorker.close(),
  ]);
  process.exit(0);
});
