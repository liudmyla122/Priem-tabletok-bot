export type ConversationStep =
  | 'idle'
  | 'awaiting_elder_name'
  | 'awaiting_elder_phone'
  | 'awaiting_elder_has_telegram'
  | 'awaiting_med_name'
  | 'awaiting_med_dosage'
  | 'awaiting_med_time'
  | 'awaiting_med_duration'
  | 'awaiting_appt_title'
  | 'awaiting_appt_datetime'
  | 'awaiting_appt_location'

export interface DraftElder {
  name?: string
  phone?: string
  hasTelegram?: boolean
}

export interface DraftMedication {
  elderId?: string
  name?: string
  dosage?: string
  times?: string[] // ["09:00", "21:00"]
  durationDays?: number // длительность курса в днях; undefined = постоянно
}

export interface DraftAppointment {
  elderId?: string
  title?: string
  location?: string
  dateTimeRaw?: string
}

export interface SessionData {
  step: ConversationStep
  draftElder: DraftElder
  draftMedication: DraftMedication
  draftAppointment: DraftAppointment
}

export function initialSession(): SessionData {
  return {
    step: 'idle',
    draftElder: {},
    draftMedication: {},
    draftAppointment: {},
  }
}
