export interface MedicationTriggerJob {
  medicationId: string;
}

export interface AppointmentTriggerJob {
  appointmentId: string;
}

export interface CheckConfirmationJob {
  reminderEventId: string;
}

export interface BillingReminderJob {
  userId: string;
}

export const QUEUE_NAMES = {
  MEDICATION_TRIGGER: "medication-trigger",
  APPOINTMENT_TRIGGER: "appointment-trigger",
  CHECK_CONFIRMATION: "check-confirmation",
  BILLING_REMINDER: "billing-reminder",
} as const;
