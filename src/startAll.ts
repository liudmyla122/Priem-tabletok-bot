import { bot } from "./bot/instance";
import { setupBot } from "./bot/setup";
import { createServer } from "./server";
import { config } from "./config";
import { Worker } from "bullmq";
import { redisConnection } from "./scheduler/redis";
import { QUEUE_NAMES } from "./types/jobs";
import type { MedicationTriggerJob, AppointmentTriggerJob, CheckConfirmationJob, BillingReminderJob } from "./types/jobs";
import {
  triggerMedicationReminder,
  triggerAppointmentReminder,
  checkAndEscalateReminder,
} from "./services/reminderService";
import { sendRenewalReminder } from "./services/paymentService";

async function startWorkers() {
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
}

async function main() {
  setupBot();

  // HTTP-сервер для вебхуков (Twilio SMS)
  const app = createServer();
  app.listen(config.port, () => {
    console.log(`🌐 HTTP-сервер вебхуков запущен на порту ${config.port}`);
  });

  // Запускаем воркеры
  await startWorkers();

  // Запускаем бота (long polling)
  await bot.start({
    onStart: () => console.log("🤖 Telegram-бот запущен (polling)"),
  });
}

main().catch((err) => {
  console.error("Критическая ошибка при запуске:", err);
  process.exit(1);
});
